import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
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

  console.log("👤 Going to profile...");
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  // Scroll down to load posts
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await delay(2000, 3000);
  }

  // Find all posts
  const posts = await page.$$('div[role="article"]');
  console.log("\n📝 Posts found: " + posts.length);

  for (let i = 0; i < Math.min(posts.length, 5); i++) {
    try {
      const text = await posts[i].textContent();
      const clean = (text || "").substring(0, 200).replace(/\n/g, " ");
      console.log("\n  Post [" + i + "]: " + clean);
      
      // Check privacy icon
      const privacy = await posts[i].$('img[alt*="Public"], img[alt*="Công khai"], span:has-text("Công khai"), span:has-text("Public")');
      console.log("  Privacy: " + (privacy ? "PUBLIC" : "unknown"));
    } catch {}
  }

  await page.screenshot({ path: path.join(LOG_DIR, "check-posts-profile.png"), fullPage: false });
  
  // Scroll back up
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1000, 2000);
  await page.screenshot({ path: path.join(LOG_DIR, "check-posts-top.png") });

  await browser.close();
  console.log("\n🔒 Done");
}
main().catch(console.error);
