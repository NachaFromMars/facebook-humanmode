/**
 * post_story_v2.ts — Đăng truyện "Ba Cuộc Gọi Nhỡ" lên Facebook
 * Fix: dùng keyboard focus thay vì tìm selector textbox
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

const HASHTAGS = "#TieuTam #nho #ai #BaCuocGoiNho #truyen #vanxuoi";

// Story beats - mỗi beat ~400 chữ
const BEATS: string[] = [];

// Load từ file gốc và chia beats
function loadBeats() {
  const raw = fs.readFileSync(path.join(__dirname, "..", "data", "stories", "ba-cuoc-goi-nho.txt"), "utf-8");
  
  // Chia theo phần (I, II, III...)
  const sections = raw.split(/\n(?=[IVX]+\n)/);
  
  // Gom lại thành beats ~400 chữ
  let current = "";
  let beatNum = 0;
  
  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    
    const words = (current + "\n\n" + trimmed).split(/\s+/).length;
    
    if (words > 500 && current.length > 0) {
      beatNum++;
      BEATS.push(current.trim());
      current = trimmed;
    } else {
      current = current ? current + "\n\n" + trimmed : trimmed;
    }
  }
  if (current.trim()) {
    beatNum++;
    BEATS.push(current.trim());
  }
}

function getRandomImage(): string | null {
  try {
    const files = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    if (files.length === 0) return null;
    return path.join(ALBUM_DIR, files[Math.floor(Math.random() * files.length)]);
  } catch { return null; }
}

async function createPost(page: any, text: string, imagePath: string | null, beatIdx: number): Promise<boolean> {
  // Go to profile
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);

  // Click "Bạn đang nghĩ gì" to open composer
  const clicked = await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      const t = s.textContent || "";
      if (t.includes("Bạn đang nghĩ gì") || t.includes("What's on your mind")) {
        const btn = s.closest('[role="button"]') || s.parentElement;
        if (btn) { (btn as HTMLElement).click(); return true; }
      }
    }
    return false;
  });
  
  if (!clicked) {
    console.log("  ⚠️ Cannot find composer button");
    return false;
  }
  console.log("  🖱️ Opened composer");
  await delay(3000, 5000);

  // Screenshot to see what opened
  await page.screenshot({ path: path.join(LOG_DIR, `story2-beat${beatIdx}-composer.png`) });

  // Find ALL contenteditable divs and pick the one in the dialog
  const typed = await page.evaluate((content: string) => {
    // Facebook composer uses a contenteditable div inside a dialog/form
    const editables = document.querySelectorAll('div[contenteditable="true"]');
    for (const el of editables) {
      const role = el.getAttribute('role');
      // The post textbox usually has role="textbox" and is inside a dialog
      if (role === 'textbox') {
        // Focus and set content
        (el as HTMLElement).focus();
        
        // Use execCommand to simulate typing
        document.execCommand('selectAll', false);
        document.execCommand('insertText', false, content);
        return true;
      }
    }
    
    // Fallback: try any contenteditable that's visible
    for (const el of editables) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 200 && rect.height > 50) {
        (el as HTMLElement).focus();
        document.execCommand('selectAll', false);
        document.execCommand('insertText', false, content);
        return true;
      }
    }
    return false;
  }, text);

  if (!typed) {
    console.log("  ⚠️ Cannot type in composer");
    await page.screenshot({ path: path.join(LOG_DIR, `story2-beat${beatIdx}-no-textbox.png`) });
    
    // Fallback: try Tab key to focus and type
    await page.keyboard.press("Tab");
    await delay(500, 1000);
    await page.keyboard.press("Tab");
    await delay(500, 1000);
    
    // Try typing directly
    for (const char of text.substring(0, 100)) {
      await page.keyboard.type(char, { delay: 10 });
    }
    await delay(1000, 2000);
  } else {
    console.log(`  ✍️ Typed ${text.length} chars`);
  }
  
  await delay(2000, 3000);

  // Try to attach image
  if (imagePath) {
    try {
      // Look for photo button or file input
      const attached = await page.evaluate(() => {
        const btns = document.querySelectorAll('div[role="button"], div[aria-label]');
        for (const btn of btns) {
          const label = btn.getAttribute('aria-label') || btn.textContent || "";
          if (label.includes("Ảnh") || label.includes("Photo") || label.includes("photo") || label.includes("Video")) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      
      if (attached) {
        await delay(2000, 3000);
        const fileInput = await page.$('input[type="file"]');
        if (fileInput) {
          await fileInput.setInputFiles(imagePath);
          console.log(`  📷 Attached: ${path.basename(imagePath)}`);
          await delay(3000, 5000);
        }
      }
    } catch (e: any) {
      console.log(`  ⚠️ Image: ${e.message?.substring(0, 50)}`);
    }
  }

  await page.screenshot({ path: path.join(LOG_DIR, `story2-beat${beatIdx}-ready.png`) });

  // Click Post/Đăng button
  const posted = await page.evaluate(() => {
    const btns = document.querySelectorAll('div[role="button"], span');
    for (const btn of btns) {
      const text = btn.textContent?.trim() || "";
      const label = (btn as HTMLElement).getAttribute?.('aria-label') || "";
      if ((text === "Đăng" || text === "Post" || label === "Đăng" || label === "Post") && 
          btn.closest('[role="dialog"], form')) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  });

  if (posted) {
    console.log("  ✅ POSTED!");
  } else {
    console.log("  ⚠️ Post button not found, trying Ctrl+Enter");
    await page.keyboard.press("Control+Enter");
  }

  await delay(5000, 8000);
  await page.screenshot({ path: path.join(LOG_DIR, `story2-beat${beatIdx}-done.png`) });
  
  return true;
}

async function main() {
  loadBeats();
  console.log("🦊 ĐĂNG TRUYỆN — Ba Cuộc Gọi Nhỡ (V2)");
  console.log(`📖 ${BEATS.length} beats\n`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  
  const page = await context.newPage();
  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  if (page.url().includes("login")) {
    console.log("❌ Cookies expired!");
    await browser.close();
    return;
  }
  console.log("✅ Login OK\n");

  let posted = 0;
  for (let i = 0; i < BEATS.length; i++) {
    const beatText = `${BEATS[i]}\n\n(Phần ${i + 1}/${BEATS.length})\n\n${HASHTAGS}`;
    console.log(`\n═══ Beat ${i + 1}/${BEATS.length} ═══`);
    
    const img = getRandomImage();
    const ok = await createPost(page, beatText, img, i + 1);
    if (ok) posted++;

    // Wait 60-90s between posts
    if (i < BEATS.length - 1) {
      const wait = 60 + Math.floor(Math.random() * 30);
      console.log(`  ⏸️ ${wait}s...`);
      await delay(wait * 1000, wait * 1000 + 5000);
    }
  }

  // Save cookies
  const nc = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(nc, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(nc, null, 2));

  await browser.close();
  console.log(`\n🦊 XONG: ${posted}/${BEATS.length} beats đã đăng!`);
}

main().catch(console.error);
