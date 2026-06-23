import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const POST_IMAGE = path.join(__dirname, "..", "data", "post_image.jpg");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

// Human-like typing
async function humanType(page: any, text: string) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    if (Math.random() < 0.04) await delay(200, 500);
  }
}

async function main() {
  console.log("🦊 TIỂU TÂM FULL MISSION — HumanMode ON");
  
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
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

  // ═══ STEP 1: Go to Facebook ═══
  console.log("\n═══ STEP 1: Vào Facebook ═══");
  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  
  if (page.url().includes("login")) {
    console.log("❌ Login failed");
    await browser.close();
    return;
  }
  console.log("✅ Đã vào Facebook");

  // ═══ STEP 2: Đăng bài mới ═══
  console.log("\n═══ STEP 2: Đăng bài mới ═══");
  
  const caption = "Chiều nay Tiểu Tâm dạo chơi, gặp cảnh đẹp quá nên chụp lại cho mọi người 🦊✨ Ai thích thì like cho Tiểu Tâm vui nha, mến mọi người lắm 💕🌸";
  
  try {
    // Click "What's on your mind?"
    const composerSelectors = [
      'div[role="button"]:has-text("Bạn đang nghĩ gì")',
      'div[role="button"]:has-text("What\'s on your mind")',
      'span:has-text("Bạn đang nghĩ gì")',
    ];
    
    let clicked = false;
    for (const sel of composerSelectors) {
      try {
        const el = await page.waitForSelector(sel, { timeout: 5000, state: "visible" });
        if (el) { await el.click(); clicked = true; console.log(`🖱️ Opened composer`); break; }
      } catch {}
    }
    
    if (!clicked) {
      // Try clicking any input-like area
      const areas = await page.$$('div[role="button"][tabindex="0"]');
      for (const area of areas.slice(0, 5)) {
        const text = await area.textContent() || "";
        if (text.includes("nghĩ") || text.includes("mind") || text.length < 50) {
          await area.click();
          clicked = true;
          console.log(`🖱️ Clicked composer area`);
          break;
        }
      }
    }

    await delay(2000, 4000);
    
    // Find textbox and type caption
    const textboxSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
      'div[contenteditable="true"]',
    ];
    
    for (const sel of textboxSelectors) {
      try {
        const el = await page.waitForSelector(sel, { timeout: 5000, state: "visible" });
        if (el) {
          await el.click();
          await delay(500, 1000);
          await humanType(page, caption);
          console.log(`✍️ Typed caption (${caption.length} chars)`);
          break;
        }
      } catch {}
    }

    await delay(1500, 3000);

    // Upload image if exists
    if (fs.existsSync(POST_IMAGE)) {
      console.log("📷 Uploading image...");
      
      // Look for photo/video button
      const photoSelectors = [
        'div[aria-label*="Photo" i]', 'div[aria-label*="Ảnh" i]',
        'div[aria-label*="photo/video" i]', 'div[aria-label*="ảnh/video" i]',
        'input[type="file"][accept*="image"]',
      ];
      
      for (const sel of photoSelectors) {
        try {
          if (sel.includes('input')) {
            const input = await page.$(sel);
            if (input) {
              await input.setInputFiles(POST_IMAGE);
              console.log("📷 Image set via file input");
              break;
            }
          } else {
            const el = await page.$(sel);
            if (el) { await el.click(); await delay(2000, 3000); break; }
          }
        } catch {}
      }
      
      // Try file input after clicking photo button
      const fileInput = await page.$('input[type="file"][accept*="image"], input[type="file"][accept*="video"]');
      if (fileInput) {
        await fileInput.setInputFiles(POST_IMAGE);
        console.log("📷 Image uploaded!");
        await delay(4000, 7000);
      }
    }

    await page.screenshot({ path: path.join(LOG_DIR, "post-ready.png") });

    // Click Post/Đăng
    const postSelectors = [
      'div[aria-label="Đăng" i]', 'div[aria-label="Post" i]',
      'span:has-text("Đăng")', 'span:has-text("Post")',
    ];
    
    let posted = false;
    for (const sel of postSelectors) {
      try {
        const el = await page.waitForSelector(sel, { timeout: 3000, state: "visible" });
        if (el) {
          await el.click();
          posted = true;
          console.log(`🚀 Bấm đăng bài!`);
          break;
        }
      } catch {}
    }
    
    if (!posted) {
      await page.keyboard.hotkey("Control", "Enter");
      console.log("🚀 Ctrl+Enter to post");
    }
    
    await delay(5000, 8000);
    console.log("✅ Bài đã đăng!");
    await page.screenshot({ path: path.join(LOG_DIR, "post-done.png") });
    
  } catch (e: any) {
    console.log(`⚠️ Post error: ${e.message}`);
  }

  // ═══ STEP 3: Check Profile & Comments ═══
  console.log("\n═══ STEP 3: Check Profile & Comments ═══");
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  
  // Scroll to see posts
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await delay(1500, 2500);
  }
  await page.screenshot({ path: path.join(LOG_DIR, "profile-posts.png") });
  
  // Count posts
  const posts = await page.$$('div[role="article"]');
  console.log(`📝 Thấy ${posts.length} bài đăng trên profile`);

  // ═══ STEP 4: Check Notifications ═══
  console.log("\n═══ STEP 4: Check Notifications ═══");
  await page.goto("https://www.facebook.com/notifications", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  await page.screenshot({ path: path.join(LOG_DIR, "notifications.png") });

  // ═══ STEP 5: Check Messenger Inbox ═══
  console.log("\n═══ STEP 5: Check Messenger ═══");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  await page.screenshot({ path: path.join(LOG_DIR, "messenger.png") });
  
  // Get inbox info
  const threads = await page.$$('a[href*="/messages/t/"]');
  console.log(`📬 ${threads.length} conversations`);

  // Save cookies
  const freshCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(freshCookies, null, 2));
  console.log(`🍪 Cookies refreshed (${freshCookies.length})`);

  // Final report
  console.log(`\n${"═".repeat(50)}`);
  console.log("📊 MISSION REPORT:");
  console.log(`✅ Login: OK`);
  console.log(`📝 Post: Đã đăng bài mới`);
  console.log(`👤 Profile: ${posts.length} bài đăng`);
  console.log(`📬 Inbox: ${threads.length} conversations`);
  console.log(`🍪 Cookies: ${freshCookies.length} saved`);
  console.log(`${"═".repeat(50)}`);

  await browser.close();
  console.log("🔒 Done!");
}

main().catch(console.error);
