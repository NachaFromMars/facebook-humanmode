import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  console.log(`🍪 Loaded ${cookies.length} cookies`);

  const page = await context.newPage();

  // Go to profile
  console.log("📍 Going to profile...");
  await page.goto("https://www.facebook.com/me", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);

  const url = page.url();
  console.log(`📍 URL: ${url}`);

  // Check if logged in
  if (url.includes("login")) {
    console.log("❌ NOT LOGGED IN — cookies expired");
    await browser.close();
    return;
  }

  // Get profile name
  const title = await page.title();
  console.log(`📄 Page title: ${title}`);

  // Get profile URL (the real one)
  const profileUrl = page.url();
  console.log(`👤 Profile URL: ${profileUrl}`);

  // Screenshot profile
  await page.screenshot({ path: path.join(LOG_DIR, "check-profile.png") });

  // Scroll down to see posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await delay(1500, 2500);
  }
  await page.screenshot({ path: path.join(LOG_DIR, "check-profile-scrolled.png") });

  // Get page text to understand what's on screen
  const bodyText = await page.evaluate(() => {
    const articles = document.querySelectorAll('div[role="article"]');
    const texts: string[] = [];
    articles.forEach((a, i) => {
      if (i < 5) {
        const t = a.textContent?.slice(0, 200) || "";
        texts.push(`Post ${i}: ${t}`);
      }
    });
    return texts.join("\n---\n");
  });
  
  console.log("\n📝 Posts found on profile:");
  console.log(bodyText || "(no posts found)");

  // Check activity log
  console.log("\n📋 Checking activity log...");
  await page.goto("https://www.facebook.com/me/allactivity", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  await page.screenshot({ path: path.join(LOG_DIR, "check-activity.png") });

  // Save fresh cookies
  const freshCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(freshCookies, null, 2));
  console.log(`🍪 Cookies refreshed (${freshCookies.length})`);

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
