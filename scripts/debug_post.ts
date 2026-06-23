/**
 * debug_post.ts — Debug Facebook post button
 * Mở composer, type text, rồi dump tất cả buttons để tìm nút "Đăng"
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("🔍 DEBUG POST BUTTON");

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
  
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Go to profile
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);

  // Open composer
  await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      if ((s.textContent || "").includes("Bạn đang nghĩ gì")) {
        const btn = s.closest('[role="button"]') || s.parentElement;
        if (btn) (btn as HTMLElement).click();
        break;
      }
    }
  });
  await delay(4000, 6000);
  console.log("✅ Composer opened");

  // Type something
  await page.evaluate((text: string) => {
    const editables = document.querySelectorAll('div[contenteditable="true"][role="textbox"]');
    for (const el of editables) {
      (el as HTMLElement).focus();
      document.execCommand('insertText', false, text);
      return;
    }
  }, "Test post từ Tiểu Tâm 🦊 #TieuTam");
  await delay(2000, 3000);
  console.log("✅ Text typed");

  // Now dump ALL buttons in the dialog
  const buttons = await page.evaluate(() => {
    const results: any[] = [];
    
    // Find dialog
    const dialogs = document.querySelectorAll('[role="dialog"]');
    for (const dialog of dialogs) {
      // All buttons inside dialog
      const btns = dialog.querySelectorAll('[role="button"], button, [tabindex]');
      for (const btn of btns) {
        const text = (btn.textContent || "").trim().substring(0, 50);
        const ariaLabel = btn.getAttribute('aria-label') || "";
        const role = btn.getAttribute('role') || "";
        const tag = btn.tagName;
        const classes = btn.className?.toString().substring(0, 80) || "";
        const rect = btn.getBoundingClientRect();
        
        if (text || ariaLabel) {
          results.push({
            text,
            ariaLabel,
            role,
            tag,
            classes,
            x: Math.round(rect.x),
            y: Math.round(rect.y),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
      }
    }
    return results;
  });

  console.log(`\n🔍 Found ${buttons.length} buttons in dialog:`);
  for (const b of buttons) {
    const isDang = b.text.includes("Đăng") || b.ariaLabel.includes("Đăng") || b.text === "Post";
    console.log(`  ${isDang ? "⭐" : "  "} [${b.tag}] text="${b.text}" aria="${b.ariaLabel}" role="${b.role}" pos=(${b.x},${b.y}) size=${b.w}x${b.h}`);
  }

  await page.screenshot({ path: path.join(LOG_DIR, "debug-post-buttons.png") });
  
  // Try clicking the "Đăng" button by coordinates or text match
  const postBtn = buttons.find(b => 
    b.text === "Đăng" || b.text === "Post" || 
    b.ariaLabel === "Đăng" || b.ariaLabel === "Post"
  );
  
  if (postBtn) {
    console.log(`\n⭐ FOUND POST BUTTON: text="${postBtn.text}" at (${postBtn.x}, ${postBtn.y})`);
    
    // Click by coordinates
    await page.mouse.click(postBtn.x + postBtn.w / 2, postBtn.y + postBtn.h / 2);
    console.log("🖱️ Clicked post button!");
    await delay(5000, 8000);
    await page.screenshot({ path: path.join(LOG_DIR, "debug-post-after-click.png") });
  } else {
    console.log("\n❌ Post button not found in dialog");
    
    // Try alternative: find any div with exact text "Đăng"
    const alt = await page.evaluate(() => {
      const all = document.querySelectorAll('div, span');
      for (const el of all) {
        if (el.textContent?.trim() === "Đăng" && el.children.length === 0) {
          const rect = el.getBoundingClientRect();
          return { x: rect.x, y: rect.y, w: rect.width, h: rect.height, tag: el.tagName };
        }
      }
      return null;
    });
    
    if (alt) {
      console.log(`⭐ FOUND via text search: ${alt.tag} at (${alt.x}, ${alt.y})`);
      await page.mouse.click(alt.x + alt.w / 2, alt.y + alt.h / 2);
      console.log("🖱️ Clicked!");
      await delay(5000, 8000);
      await page.screenshot({ path: path.join(LOG_DIR, "debug-post-alt-click.png") });
    }
  }

  // Check if post was created — go to profile and see
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  await page.screenshot({ path: path.join(LOG_DIR, "debug-post-profile-check.png") });
  console.log("📸 Profile check screenshot saved");

  // Save cookies
  const nc = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(nc, null, 2));
  fs.writeFileSync(path.join(__dirname, "..", "data", "cookies", "session.json"), JSON.stringify(nc, null, 2));

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
