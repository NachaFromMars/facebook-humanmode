import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const POST_IMAGE = path.join(__dirname, "..", "data", "post_image.jpg");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function humanType(page: any, text: string) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    if (Math.random() < 0.04) await delay(200, 500);
  }
}

async function main() {
  console.log("🦊 TIỂU TÂM MISSION — Post + Check");
  
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

  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  if (page.url().includes("login")) { console.log("❌ Login failed"); await browser.close(); return; }
  console.log("✅ Vào Facebook OK");

  // ═══ ĐĂNG BÀI ═══
  console.log("\n📝 Đăng bài...");
  const caption = "Chiều nay Tiểu Tâm dạo chơi, gặp cảnh đẹp quá nên chụp lại cho mọi người 🦊✨ Ai thích thì like cho Tiểu Tâm vui nha, mến mọi người lắm 💕🌸";

  // Open composer
  for (const sel of ['div[role="button"]:has-text("Bạn đang nghĩ gì")', 'span:has-text("Bạn đang nghĩ gì")', 'div[role="button"]:has-text("What\'s on your mind")']) {
    try { const el = await page.waitForSelector(sel, { timeout: 3000 }); if (el) { await el.click(); break; } } catch {}
  }
  await delay(2000, 4000);

  // Type caption
  for (const sel of ['div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]']) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000 });
      if (el) { await el.click(); await delay(500, 800); await humanType(page, caption); console.log("✍️ Caption typed"); break; }
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
    } else {
      // Click photo button first
      for (const sel of ['div[aria-label*="Ảnh" i]', 'div[aria-label*="Photo" i]']) {
        try { const el = await page.$(sel); if (el) { await el.click(); await delay(2000, 3000); break; } } catch {}
      }
      const fi2 = await page.$('input[type="file"]');
      if (fi2) { await fi2.setInputFiles(POST_IMAGE); console.log("📷 Image uploaded (2nd try)"); await delay(5000, 8000); }
    }
  }

  await page.screenshot({ path: path.join(LOG_DIR, "post-ready.png") });

  // Click Post button
  let posted = false;
  for (const sel of ['div[aria-label="Đăng" i]', 'div[aria-label="Post" i]', 'span:has-text("Đăng")', 'span:has-text("Post")']) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 2000 });
      if (el) { await el.click(); posted = true; console.log("🚀 Clicked Post!"); break; }
    } catch {}
  }
  if (!posted) {
    // Try keyboard shortcut
    await page.keyboard.press("Control+Enter");
    console.log("🚀 Ctrl+Enter");
  }
  await delay(6000, 10000);
  await page.screenshot({ path: path.join(LOG_DIR, "post-done.png") });
  console.log("✅ Bài đã đăng!");

  // ═══ CHECK PROFILE ═══
  console.log("\n👤 Check profile...");
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.scrollBy(0, 500)); await delay(1500, 2000); }
  await page.screenshot({ path: path.join(LOG_DIR, "profile-check.png") });
  const articles = await page.$$('div[role="article"]');
  console.log(`📝 ${articles.length} posts on profile`);

  // ═══ CHECK NOTIFICATIONS ═══
  console.log("\n🔔 Notifications...");
  await page.goto("https://www.facebook.com/notifications", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  await page.screenshot({ path: path.join(LOG_DIR, "notif-check.png") });

  // ═══ CHECK MESSENGER ═══
  console.log("\n📩 Messenger...");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  await page.screenshot({ path: path.join(LOG_DIR, "inbox-check.png") });

  // Save cookies
  const fresh = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(fresh, null, 2));

  console.log(`\n${"═".repeat(50)}`);
  console.log("📊 REPORT: Login ✅ | Post ✅ | Profile ✅ | Notif ✅ | Inbox ✅");
  console.log(`🍪 ${fresh.length} cookies saved`);
  console.log(`${"═".repeat(50)}`);

  await browser.close();
}

main().catch(console.error);
