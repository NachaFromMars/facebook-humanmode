/**
 * fb_media.ts — Media upload for Facebook posts and messages.
 *
 * Uses two strategies for file upload:
 * 1. setInputFiles() — inject directly into hidden <input type="file">
 * 2. fileChooser — intercept native OS file dialog (fallback)
 *
 * Supports: images (jpg, png, gif, webp), videos (mp4, mov).
 *
 * @module fb_media
 */

import { Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { humanClick, randomDelay, humanPause } from "./humanmode.js";

// ─── Timestamp Utility ───────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── Supported Formats ───────────────────────────────────────────

const SUPPORTED_IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const SUPPORTED_VIDEO_EXTS = [".mp4", ".mov"];
const ALL_SUPPORTED_EXTS = [...SUPPORTED_IMAGE_EXTS, ...SUPPORTED_VIDEO_EXTS];

/**
 * Validate that all file paths exist and have supported extensions.
 * @param filePaths - Array of file paths to validate
 * @throws Error if any file is invalid
 */
function validateFiles(filePaths: string[]): void {
  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) {
      throw new Error(`File not found: ${fp}`);
    }
    const ext = path.extname(fp).toLowerCase();
    if (!ALL_SUPPORTED_EXTS.includes(ext)) {
      throw new Error(`Unsupported file type: ${ext} (file: ${fp})`);
    }
  }
}

/**
 * Check if any of the provided files is a video.
 * @param filePaths - Array of file paths
 * @returns true if at least one file is a video
 */
function hasVideo(filePaths: string[]): boolean {
  return filePaths.some((fp) => SUPPORTED_VIDEO_EXTS.includes(path.extname(fp).toLowerCase()));
}

// ─── Selectors ────────────────────────────────────────────────────

/** Fallback selectors for upload-related elements. */
const UPLOAD_SELECTORS = {
  /** Photo/Video button in post composer */
  photoVideoButton: [
    'div[aria-label="Photo/video"]',
    'div[aria-label="Ảnh/video"]',
    'div[aria-label="Photo/Video"]',
    'span:has-text("Photo/video")',
    'span:has-text("Ảnh/video")',
    'div[role="button"]:has-text("Photo")',
  ],
  /** Hidden file input elements */
  fileInput: [
    'input[type="file"][accept*="image"]',
    'input[type="file"][accept*="video"]',
    'input[type="file"]',
    'form input[type="file"]',
  ],
  /** Upload preview container */
  uploadPreview: [
    'div[aria-label="Uploaded content"]',
    'div[aria-label="Nội dung đã tải lên"]',
    'div[data-testid="media-attachment"]',
    'div[role="img"]',
  ],
};

/**
 * Find the first matching selector from a list.
 * @param page - Playwright Page
 * @param selectors - Array of CSS selectors to try
 * @param timeout - Timeout per selector in ms
 * @returns First matching selector or null
 */
async function findSelector(page: Page, selectors: string[], timeout = 3000): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout });
      if (el) return sel;
    } catch {
      // try next
    }
  }
  return null;
}

// ─── Upload Strategy 1: setInputFiles ─────────────────────────────

/**
 * Upload files by finding a hidden <input type="file"> and using setInputFiles().
 * This is the most reliable method as it bypasses the OS file picker entirely.
 *
 * @param page - Playwright Page
 * @param filePaths - Array of absolute file paths to upload
 * @returns true if upload succeeded
 */
async function uploadViaInputFiles(page: Page, filePaths: string[]): Promise<boolean> {
  console.log(`${ts()} 📎 Trying setInputFiles strategy...`);

  const inputSel = await findSelector(page, UPLOAD_SELECTORS.fileInput, 5000);
  if (!inputSel) {
    console.log(`${ts()} ⚠️ No file input found for setInputFiles strategy`);
    return false;
  }

  try {
    const input = await page.$(inputSel);
    if (!input) return false;

    // Resolve absolute paths
    const resolvedPaths = filePaths.map((fp) => path.resolve(fp));
    await input.setInputFiles(resolvedPaths);

    console.log(`${ts()} ✅ Files injected via setInputFiles: ${resolvedPaths.length} file(s)`);
    return true;
  } catch (err) {
    console.log(`${ts()} ⚠️ setInputFiles failed: ${(err as Error).message}`);
    return false;
  }
}

// ─── Upload Strategy 2: fileChooser ───────────────────────────────

/**
 * Upload files by clicking an upload button and intercepting the fileChooser event.
 * Used as a fallback when no hidden file input is available.
 *
 * @param page - Playwright Page
 * @param filePaths - Array of absolute file paths to upload
 * @returns true if upload succeeded
 */
async function uploadViaFileChooser(page: Page, filePaths: string[]): Promise<boolean> {
  console.log(`${ts()} 📎 Trying fileChooser strategy...`);

  // Find the upload button
  const btnSel = await findSelector(page, UPLOAD_SELECTORS.photoVideoButton, 5000);
  if (!btnSel) {
    console.log(`${ts()} ⚠️ No upload button found for fileChooser strategy`);
    return false;
  }

  try {
    const resolvedPaths = filePaths.map((fp) => path.resolve(fp));

    // Set up file chooser listener BEFORE clicking
    const [fileChooser] = await Promise.all([
      page.waitForEvent("filechooser", { timeout: 10_000 }),
      humanClick(page, btnSel),
    ]);

    await fileChooser.setFiles(resolvedPaths);
    console.log(`${ts()} ✅ Files uploaded via fileChooser: ${resolvedPaths.length} file(s)`);
    return true;
  } catch (err) {
    console.log(`${ts()} ⚠️ fileChooser failed: ${(err as Error).message}`);
    return false;
  }
}

// ─── Main Upload Functions ───────────────────────────────────────

/**
 * Upload media files using the best available strategy.
 * Tries setInputFiles first, then falls back to fileChooser.
 *
 * @param page - Playwright Page
 * @param filePaths - Array of file paths (images or videos) to upload
 * @returns true if upload succeeded
 */
export async function uploadMedia(page: Page, filePaths: string[]): Promise<boolean> {
  if (filePaths.length === 0) {
    console.log(`${ts()} ⚠️ No files to upload`);
    return false;
  }

  validateFiles(filePaths);
  console.log(`${ts()} 📤 Uploading ${filePaths.length} file(s)...`);

  // Strategy 1: setInputFiles
  let success = await uploadViaInputFiles(page, filePaths);

  // Strategy 2: fileChooser fallback
  if (!success) {
    success = await uploadViaFileChooser(page, filePaths);
  }

  if (!success) {
    console.log(`${ts()} ❌ All upload strategies failed`);
    return false;
  }

  // Wait for upload preview to appear
  await waitForUploadPreview(page, hasVideo(filePaths));
  return true;
}

/**
 * Upload files to the post composer. Clicks the Photo/Video button first,
 * then uses uploadMedia.
 *
 * @param page - Playwright Page
 * @param filePaths - Array of file paths to upload
 * @returns true if upload succeeded
 */
export async function uploadToComposer(page: Page, filePaths: string[]): Promise<boolean> {
  if (filePaths.length === 0) return false;

  validateFiles(filePaths);
  console.log(`${ts()} 📤 Uploading to composer: ${filePaths.length} file(s)`);

  // Click Photo/Video button to open the upload area
  const btnSel = await findSelector(page, UPLOAD_SELECTORS.photoVideoButton, 5000);
  if (btnSel) {
    await humanClick(page, btnSel);
    await randomDelay(1000, 2000);
  }

  // Now try to upload
  return uploadMedia(page, filePaths);
}

/**
 * Wait for the upload preview to appear (confirm upload processed).
 * Videos take longer to process (up to 60s).
 *
 * @param page - Playwright Page
 * @param isVideo - Whether a video is being uploaded (extends timeout)
 */
async function waitForUploadPreview(page: Page, isVideo: boolean): Promise<void> {
  const timeout = isVideo ? 60_000 : 15_000;
  console.log(`${ts()} ⏳ Waiting for upload preview (timeout: ${timeout / 1000}s)...`);

  const previewSel = await findSelector(page, UPLOAD_SELECTORS.uploadPreview, timeout);
  if (previewSel) {
    console.log(`${ts()} ✅ Upload preview detected`);
  } else {
    console.log(`${ts()} ⚠️ Upload preview not detected — upload may still be processing`);
  }

  await randomDelay(1000, 2000);
}
