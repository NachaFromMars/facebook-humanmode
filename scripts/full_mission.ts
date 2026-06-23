/**
 * full_mission.ts — Tiểu Tâm Full Facebook Mission
 * Login (cookies) → Screenshot → Scan profile → Check comments → Post → Check inbox → Report
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const POST_IMAGE = path.join(__dirname, "..", "data", "post_image.jpg");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

// Human-like type
async function humanType(page: any, selector: any, text: string) {
  const el = typeof selector === 'string' ? await page.$(selector) : selector;
  if (!el) return;
  await el.click();
  await delay(300, 600);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 60 + Math.random() * 100 });
    if (Math.random() < 0.05) await delay(200, 500); // occasional pause
  }
}

interface Report {
  login: string;
  profileName: string;
  friendCount: string;
  recentPosts: string[];
  commentsFound: number;
  commentsReplied: number;
  postStatus: string;
  inboxThreads: number;
  inboxReplied: number;
  screenshots: string[];
  errors: string[];
}

const report: Report = {
  login: "pending",
  profileName: "",
  friendCount: "",
  recentPosts: [],
  commentsFound: 0,
  commentsReplied: 0,
  postStatus: "pending",
  inboxThreads: 0,
  inboxReplied: 0,
  screenshots: [],
  errors: [],
};

async function main() {
  console.log("🦊 TIỂU TÂM FACEBOOK MISSION START");
  
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
  });

  // Mask webdriver
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Load cookies
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
    await context.addCookies(cookies);
    console.log(`🍪 Loaded ${cookies.length} cookies`);
  }

  const page = await context.newPage();

  try {
    // ═══ STEP 1: Login & Screenshot ═══
    console.log("\n═══ STEP 1: Vào Facebook ═══");
    await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000, 5000);

    let url = page.url();
    console.log(`📍 URL: ${url}`);

    // Check if logged in
    if (url.includes("/login") || url.includes("checkpoint")) {
      console.log("❌ Cookies hết hạn, cần login lại...");
      // Quick re-login
      await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded" });
      await delay(2000, 3000);
      await page.type('input[name="email"]', "onlyfan131313@gmail.com", { delay: 90 });
      await delay(500, 800);
      await page.type('input[name="pass"]', "@Awaken13", { delay: 90 });
      await delay(500, 800);
      await page.keyboard.press("Enter");
      await delay(8000, 12000);
      
      // Handle CAPTCHA if needed
      for (const frame of page.frames()) {
        if (frame.url().includes("recaptcha")) {
          const cb = await frame.$('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"]');
          if (cb) { await cb.click(); await delay(5000, 8000); }
        }
      }
      
      url = page.url();
    }

    // Screenshot homepage
    const ssHome = path.join(LOG_DIR, "home.png");
    await page.screenshot({ path: ssHome, fullPage: false });
    report.screenshots.push("home.png");
    report.login = "ok";
    console.log("✅ Đã vào Facebook, chụp screenshot");

    // ═══ STEP 2: Scan Profile ═══
    console.log("\n═══ STEP 2: Scan Profile ═══");
    await page.goto("https://www.facebook.com/me", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000, 5000);

    const ssProfile = path.join(LOG_DIR, "profile.png");
    await page.screenshot({ path: ssProfile, fullPage: false });
    report.screenshots.push("profile.png");

    // Get profile name
    try {
      const nameEl = await page.$('h1, [data-pagelet="ProfileTilesFeed_0"] h2, span[dir="auto"] > h1');
      if (nameEl) {
        report.profileName = (await nameEl.textContent()) || "Unknown";
        console.log(`👤 Tên: ${report.profileName}`);
      }
    } catch {}

    // Scroll to see posts
    await page.evaluate(() => window.scrollBy(0, 500));
    await delay(2000, 3000);
    await page.evaluate(() => window.scrollBy(0, 500));
    await delay(2000, 3000);
    
    const ssProfileScroll = path.join(LOG_DIR, "profile-scrolled.png");
    await page.screenshot({ path: ssProfileScroll, fullPage: false });
    report.screenshots.push("profile-scrolled.png");

    // Count visible posts
    const postEls = await page.$$('div[role="article"]');
    console.log(`📝 Thấy ${postEls.length} bài đăng trên profile`);

    // ═══ STEP 3: Check Notifications ═══
    console.log("\n═══ STEP 3: Check Notifications ═══");
    await page.goto("https://www.facebook.com/notifications", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000, 5000);

    const ssNotif = path.join(LOG_DIR, "notifications.png");
    await page.screenshot({ path: ssNotif, fullPage: false });
    report.screenshots.push("notifications.png");
    console.log("🔔 Đã chụp notifications");

    // ═══ STEP 4: Check & Reply Comments (on own posts) ═══
    console.log("\n═══ STEP 4: Check Comments ═══");
    await page.goto("https://www.facebook.com/me", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000, 5000);

    // Scroll down to load posts
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollBy(0, 600));
      await delay(1500, 2500);
    }

    // Try to find and expand comments on posts
    const commentBtns = await page.$$('div[role="button"] span:text-matches("bình luận|comment|Comment", "i")');
    console.log(`💬 Tìm thấy ${commentBtns.length} nút comment`);
    report.commentsFound = commentBtns.length;

    // ═══ STEP 5: Post Image ═══
    console.log("\n═══ STEP 5: Đăng bài mới ═══");
    
    if (fs.existsSync(POST_IMAGE)) {
      await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
      await delay(3000, 5000);

      // Click composer
      try {
        const composerSelectors = [
          'div[role="button"]:has-text("Bạn đang nghĩ gì")',
          'div[role="button"]:has-text("What\'s on your mind")',
          'span:has-text("Bạn đang nghĩ gì")',
          'div[aria-label*="Create" i]',
          'div[aria-label*="Tạo bài viết" i]',
        ];
        
        for (const sel of composerSelectors) {
          try {
            const el = await page.waitForSelector(sel, { timeout: 3000 });
            if (el) { await el.click(); console.log(`🖱️ Clicked: ${sel}`); break; }
          } catch {}
        }

        await delay(2000, 4000);

        // Type caption
        const caption = "Chiều nay Tiểu Tâm dạo chơi, gặp cảnh đẹp quá nên chụp lại cho mọi người 🦊✨ Ai thích thì like cho Tiểu Tâm vui nha 💕";
        
        const textboxSelectors = [
          'div[contenteditable="true"][role="textbox"]',
          'div[contenteditable="true"][aria-label*="Bạn đang nghĩ gì" i]',
          'div[contenteditable="true"][aria-label*="What\'s on your mind" i]',
          'div[contenteditable="true"]',
        ];

        for (const sel of textboxSelectors) {
          try {
            const el = await page.waitForSelector(sel, { timeout: 3000 });
            if (el) {
              await el.click();
              await delay(500, 1000);
              // Type caption character by character
              for (const char of caption) {
                await page.keyboard.type(char, { delay: 50 + Math.random() * 80 });
                if (Math.random() < 0.03) await delay(200, 400);
              }
              console.log(`✍️ Typed caption (${caption.length} chars)`);
              break;
            }
          } catch {}
        }

        await delay(1000, 2000);

        // Upload image
        const photoSelectors = [
          'div[aria-label*="Photo" i]',
          'div[aria-label*="Ảnh" i]',
          'div[aria-label*="photo/video" i]',
          'div[aria-label*="ảnh/video" i]',
        ];

        for (const sel of photoSelectors) {
          try {
            const el = await page.$(sel);
            if (el) { await el.click(); console.log(`📷 Clicked photo btn: ${sel}`); await delay(2000, 3000); break; }
          } catch {}
        }

        // Try file input
        const fileInput = await page.$('input[type="file"][accept*="image"], input[type="file"][accept*="video"]');
        if (fileInput) {
          await fileInput.setInputFiles(POST_IMAGE);
          console.log("📷 Image uploaded via file input");
          await delay(3000, 6000);
        }

        // Screenshot before posting
        const ssPost = path.join(LOG_DIR, "post-ready.png");
        await page.screenshot({ path: ssPost, fullPage: false });
        report.screenshots.push("post-ready.png");

        // Click Post/Đăng
        const postSelectors = [
          'div[aria-label="Post" i]',
          'div[aria-label="Đăng" i]',
          'span:has-text("Đăng")',
          'span:has-text("Post")',
        ];

        let posted = false;
        for (const sel of postSelectors) {
          try {
            const el = await page.waitForSelector(sel, { timeout: 3000 });
            if (el) {
              await el.click();
              console.log(`🚀 Clicked post: ${sel}`);
              posted = true;
              break;
            }
          } catch {}
        }

        if (!posted) {
          await page.keyboard.hotkey("Control", "Enter");
        }

        await delay(5000, 8000);
        report.postStatus = "posted";
        console.log("✅ Bài đã đăng!");

      } catch (e: any) {
        report.postStatus = `error: ${e.message}`;
        report.errors.push(`Post error: ${e.message}`);
        console.log(`❌ Post error: ${e.message}`);
      }
    } else {
      report.postStatus = "no_image";
      console.log("⚠️ Không tìm thấy ảnh để đăng");
    }

    // ═══ STEP 6: Check Messenger Inbox ═══
    console.log("\n═══ STEP 6: Check Messenger ═══");
    await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(4000, 6000);

    const ssInbox = path.join(LOG_DIR, "messenger.png");
    await page.screenshot({ path: ssInbox, fullPage: false });
    report.screenshots.push("messenger.png");

    // Count threads
    const threads = await page.$$('a[href*="/messages/t/"], div[role="row"], div[role="listitem"]');
    report.inboxThreads = threads.length;
    console.log(`📬 ${threads.length} conversations trong inbox`);

    // Save cookies for persistent login
    const freshCookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(freshCookies, null, 2));
    console.log(`🍪 Cookies refreshed & saved (${freshCookies.length})`);

  } catch (e: any) {
    console.log(`❌ Mission error: ${e.message}`);
    report.errors.push(e.message);
  } finally {
    // Save report
    const reportPath = path.join(LOG_DIR, "mission-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`\n${"═".repeat(50)}`);
    console.log("📊 MISSION REPORT:");
    console.log(JSON.stringify(report, null, 2));
    console.log(`${"═".repeat(50)}`);

    await browser.close();
    console.log("🔒 Done");
  }
}

main().catch(console.error);
