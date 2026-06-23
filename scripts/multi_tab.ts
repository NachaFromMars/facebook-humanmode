import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("🦊 Multi-tab — 1 browser, 3 tabs");

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);

  // TAB 1: Messenger
  const tab1 = await context.newPage();
  console.log("📩 Tab 1: Messenger...");
  await tab1.goto("https://www.facebook.com/messages/t/1471596454540474", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  console.log("  Tab 1 URL: " + tab1.url());
  await tab1.screenshot({ path: path.join(LOG_DIR, "multi-tab1-messenger.png") });

  // TAB 2: Profile
  const tab2 = await context.newPage();
  console.log("👤 Tab 2: Profile...");
  await tab2.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  console.log("  Tab 2 URL: " + tab2.url());
  await tab2.screenshot({ path: path.join(LOG_DIR, "multi-tab2-profile.png") });

  // TAB 3: Home
  const tab3 = await context.newPage();
  console.log("🏠 Tab 3: Home...");
  await tab3.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  console.log("  Tab 3 URL: " + tab3.url());
  await tab3.screenshot({ path: path.join(LOG_DIR, "multi-tab3-home.png") });

  const pages = context.pages();
  console.log("\n📋 Total tabs: " + pages.length);
  pages.forEach((p, i) => console.log("  [" + i + "] " + p.url().substring(0, 80)));

  // Save cookies
  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));

  await browser.close();
  console.log("\n✅ Done! 3 tabs opened successfully");
}
main().catch(console.error);
