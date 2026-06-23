import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

const REPLY_TEXT = process.env.REPLY || "";

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

  await page.goto("https://www.facebook.com/messages/t/1471596454540474", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  // Read latest messages
  const msgs = await page.$$('div[dir="auto"]');
  console.log("Messages: " + msgs.length);
  for (let i = Math.max(0, msgs.length - 10); i < msgs.length; i++) {
    try {
      const t = await msgs[i].textContent();
      if (t && t.trim().length > 2 && t.trim().length < 500) {
        console.log("  [" + i + "] " + t.trim().substring(0, 150));
      }
    } catch {}
  }

  // Send reply if provided
  if (REPLY_TEXT) {
    const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
    if (textbox && await textbox.isVisible()) {
      await textbox.click({ force: true });
      await delay(500, 1000);
      await page.keyboard.insertText(REPLY_TEXT);
      await delay(1000, 2000);
      await page.keyboard.press("Enter");
      console.log("SENT: " + REPLY_TEXT.substring(0, 80));
      await delay(3000, 5000);
    }
  }

  await page.screenshot({ path: path.join(LOG_DIR, "quick-reply.png") });

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
}
main().catch(console.error);
