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
  console.log("🦊 Vào Niết Bàn — đọc + reply all");

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
  console.log("URL: " + page.url());

  // Read ALL messages
  const msgs = await page.$$('div[dir="auto"]');
  console.log("\n💬 Total messages visible: " + msgs.length);
  
  const allMessages: string[] = [];
  for (let i = 0; i < msgs.length; i++) {
    try {
      const t = await msgs[i].textContent();
      if (t && t.trim().length > 2 && t.trim().length < 500) {
        allMessages.push(t.trim());
        console.log("  [" + i + "] " + t.trim().substring(0, 150));
      }
    } catch {}
  }

  // Screenshot
  await page.screenshot({ path: path.join(LOG_DIR, "nietban-read-all.png") });

  // Scroll up to see older messages
  console.log("\n📜 Scrolling up for more messages...");
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      const chatArea = document.querySelector('div[role="main"]');
      if (chatArea) chatArea.scrollTop = 0;
    });
    await delay(2000, 3000);
  }

  const msgs2 = await page.$$('div[dir="auto"]');
  console.log("After scroll: " + msgs2.length + " messages");
  for (let i = 0; i < msgs2.length; i++) {
    try {
      const t = await msgs2[i].textContent();
      if (t && t.trim().length > 2 && t.trim().length < 500 && !allMessages.includes(t.trim())) {
        allMessages.push(t.trim());
        console.log("  NEW [" + i + "] " + t.trim().substring(0, 150));
      }
    } catch {}
  }

  await page.screenshot({ path: path.join(LOG_DIR, "nietban-scrolled.png") });

  // Print all messages for analysis
  console.log("\n📋 ALL MESSAGES:");
  allMessages.forEach((m, i) => console.log("  " + i + ": " + m.substring(0, 200)));

  // Save for agent to read
  fs.writeFileSync(path.join(LOG_DIR, "nietban-messages.json"), JSON.stringify(allMessages, null, 2));
  console.log("\n💾 Saved to nietban-messages.json");

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
  console.log("🔒 Done");
}
main().catch(console.error);
