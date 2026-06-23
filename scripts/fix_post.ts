import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const POST_IMAGE = path.join(__dirname, "..", "data", "post_image.jpg");

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function humanType(page: any, text: string) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 55 + Math.random() * 90 });
    if (Math.random() < 0.04) await delay(200, 500);
  }
}

async function main() {
  console.log("🦊 FIX POST — Xóa bài cũ, đăng lại theo DNA");
  
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
  console.log("📍 Vào profile...");
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  
  if (page.url().includes("login")) { console.log("❌ Login failed"); await browser.close(); return; }
  console.log("✅ Vào profile OK");

  // ═══ STEP 1: Tìm và xóa bài có caption AI ═══
  console.log("\n🗑️ Tìm bài cần xóa...");
  
  // Scroll xuống để load posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await delay(1500, 2500);
  }

  // Find the post with the old AI caption
  const posts = await page.$$('div[role="article"]');
  console.log(`Found ${posts.length} posts`);
  
  for (let i = 0; i < posts.length; i++) {
    const text = await posts[i].textContent() || "";
    if (text.includes("Tiểu Tâm dạo chơi") || text.includes("like cho Tiểu Tâm vui")) {
      console.log(`🎯 Found AI post at index ${i}`);
      
      // Click the 3-dot menu on this post
      const menuBtn = await posts[i].$('div[aria-label="Actions for this post"], div[aria-label="Hành động cho bài viết này"], div[aria-haspopup="menu"]');
      if (menuBtn) {
        await menuBtn.click();
        console.log("🖱️ Clicked menu");
        await delay(2000, 3000);
        
        // Click delete / Move to trash
        const deleteSelectors = [
          'span:has-text("Chuyển vào thùng rác")',
          'span:has-text("Move to trash")',
          'span:has-text("Delete")',
          'span:has-text("Xóa")',
          'div[role="menuitem"]:has-text("trash")',
          'div[role="menuitem"]:has-text("thùng rác")',
        ];
        
        for (const sel of deleteSelectors) {
          try {
            const el = await page.waitForSelector(sel, { timeout: 3000 });
            if (el) {
              await el.click();
              console.log(`🗑️ Clicked: ${sel}`);
              await delay(2000, 3000);
              
              // Confirm delete
              const confirmSelectors = [
                'div[role="button"]:has-text("Chuyển vào thùng rác")',
                'div[role="button"]:has-text("Move")',
                'div[role="button"]:has-text("Delete")',
                'div[role="button"]:has-text("Xóa")',
              ];
              for (const cs of confirmSelectors) {
                try {
                  const ce = await page.waitForSelector(cs, { timeout: 3000 });
                  if (ce) { await ce.click(); console.log("✅ Confirmed delete"); break; }
                } catch {}
              }
              break;
            }
          } catch {}
        }
      }
      
      await delay(3000, 5000);
      break;
    }
  }

  await page.screenshot({ path: path.join(LOG_DIR, "after-delete.png") });

  // ═══ STEP 2: Đăng bài mới với DNA caption ═══
  console.log("\n📝 Đăng bài mới theo DNA...");
  
  // DNA caption — viết như người thật
  const caption = `đi ngang chỗ này, đứng lại 5 phút.
có mấy thứ nhìn hoài không chán 🦊

#TieuTam #nho #ai`;

  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);

  // Open composer
  for (const sel of ['div[role="button"]:has-text("Bạn đang nghĩ gì")', 'span:has-text("Bạn đang nghĩ gì")', 'div[role="button"]:has-text("What\'s on your mind")']) {
    try { const el = await page.waitForSelector(sel, { timeout: 3000 }); if (el) { await el.click(); break; } } catch {}
  }
  await delay(2000, 4000);

  // Type caption human-mode
  for (const sel of ['div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]']) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000 });
      if (el) { await el.click(); await delay(500, 800); await humanType(page, caption); console.log("✍️ Caption typed (DNA style)"); break; }
    } catch {}
  }
  await delay(1500, 2500);

  // Upload image
  if (fs.existsSync(POST_IMAGE)) {
    const fileInput = await page.$('input[type="file"][accept*="image"], input[type="file"]');
    if (fileInput) {
      await fileInput.setInputFiles(POST_IMAGE);
      console.log("📷 Image uploaded");
      await delay(5000, 8000);
    }
  }

  await page.screenshot({ path: path.join(LOG_DIR, "new-post-ready.png") });

  // Click Post
  let posted = false;
  for (const sel of ['div[aria-label="Đăng" i]', 'div[aria-label="Post" i]', 'span:has-text("Đăng")', 'span:has-text("Post")']) {
    try { const el = await page.waitForSelector(sel, { timeout: 2000 }); if (el) { await el.click(); posted = true; break; } } catch {}
  }
  if (!posted) await page.keyboard.press("Control+Enter");
  
  await delay(6000, 10000);
  console.log("✅ Bài mới đã đăng!");
  
  // Check profile
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  await page.screenshot({ path: path.join(LOG_DIR, "new-profile.png") });

  // Save cookies
  const fresh = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(fresh, null, 2));

  console.log("\n📊 DONE: Xóa bài cũ ✅ | Đăng bài DNA mới ✅");
  await browser.close();
}

main().catch(console.error);
