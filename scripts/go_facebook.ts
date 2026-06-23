import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const POST_IMAGE = path.join(__dirname, "..", "data", "post_image.jpg");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("🦊 TIỂU TÂM VÀO FACEBOOK!");
  
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

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  console.log(`🍪 Loaded ${cookies.length} cookies`);

  const page = await context.newPage();

  // Go to Facebook
  console.log("🌐 Đi tới Facebook...");
  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);

  const url = page.url();
  console.log(`📍 URL: ${url}`);

  // Check if logged in
  if (url.includes("login") || url.includes("checkpoint")) {
    console.log("❌ CHƯA ĐĂNG NHẬP — cookies không hợp lệ hoặc hết hạn");
    await page.screenshot({ path: path.join(LOG_DIR, "login-failed.png") });
    await browser.close();
    return;
  }

  console.log("✅ ĐÃ VÀO FACEBOOK!");

  // Screenshot homepage
  await page.screenshot({ path: path.join(LOG_DIR, "fb-home.png") });
  console.log("📸 Screenshot homepage");

  // Go to profile
  console.log("\n📍 Vào profile...");
  await page.goto("https://www.facebook.com/me", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  
  const profileUrl = page.url();
  console.log(`👤 Profile URL: ${profileUrl}`);
  
  // Get profile name
  const title = await page.title();
  console.log(`📄 Title: ${title}`);
  
  await page.screenshot({ path: path.join(LOG_DIR, "fb-profile.png") });
  console.log("📸 Screenshot profile");

  // Scroll to see posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 500));
    await delay(1500, 2500);
  }
  await page.screenshot({ path: path.join(LOG_DIR, "fb-profile-scroll.png") });

  // Check notifications
  console.log("\n🔔 Check notifications...");
  await page.goto("https://www.facebook.com/notifications", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  await page.screenshot({ path: path.join(LOG_DIR, "fb-notifications.png") });

  // Check messenger
  console.log("\n📩 Check messenger...");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  await page.screenshot({ path: path.join(LOG_DIR, "fb-messenger.png") });

  // Save refreshed cookies
  const freshCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(freshCookies, null, 2));
  console.log(`🍪 Cookies refreshed (${freshCookies.length} cookies saved)`);

  // Report
  console.log(`\n${"═".repeat(50)}`);
  console.log("📊 BÁO CÁO:");
  console.log(`✅ Login: OK`);
  console.log(`👤 Profile: ${title}`);
  console.log(`📍 URL: ${profileUrl}`);
  console.log(`🍪 Cookies: ${freshCookies.length} (refreshed & saved)`);
  console.log(`${"═".repeat(50)}`);

  await browser.close();
  console.log("🔒 Done!");
}

main().catch(console.error);
