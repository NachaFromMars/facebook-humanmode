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

  // Scroll to bottom to see latest messages
  await page.evaluate(() => {
    const main = document.querySelector('div[role="main"]');
    if (main) main.scrollTop = main.scrollHeight;
  });
  await delay(2000, 3000);

  // Screenshot the full chat area
  await page.screenshot({ path: path.join(LOG_DIR, "nietban-latest-chat.png") });
  console.log("📸 Full chat screenshot saved");

  // Find all images in the chat
  const images = await page.$$('img');
  console.log("🖼️ Total images on page: " + images.length);

  let imgCount = 0;
  for (const img of images) {
    try {
      const src = await img.getAttribute("src");
      const alt = await img.getAttribute("alt");
      const width = await img.evaluate(el => el.getBoundingClientRect().width);
      const height = await img.evaluate(el => el.getBoundingClientRect().height);
      
      // Only save large images (likely chat images, not avatars/icons)
      if (width > 100 && height > 100 && src && !src.includes("emoji") && !src.includes("avatar")) {
        imgCount++;
        console.log("  IMG[" + imgCount + "] " + Math.round(width) + "x" + Math.round(height) + " alt=\"" + (alt || "").substring(0, 50) + "\" src=" + (src || "").substring(0, 100));
        
        // Click on image to see full size
        if (imgCount <= 3) {
          try {
            await img.click();
            await delay(2000, 3000);
            await page.screenshot({ path: path.join(LOG_DIR, "nietban-image-" + imgCount + ".png") });
            console.log("  📸 Saved enlarged image " + imgCount);
            
            // Close overlay
            try {
              const closeBtn = await page.$('div[aria-label="Đóng"], div[aria-label="Close"]');
              if (closeBtn && await closeBtn.isVisible()) {
                await closeBtn.click({ force: true });
                await delay(1000, 2000);
              } else {
                await page.keyboard.press("Escape");
                await delay(1000, 2000);
              }
            } catch {}
          } catch {}
        }
      }
    } catch {}
  }

  // Also read latest text messages
  const msgs = await page.$$('div[dir="auto"]');
  console.log("\n💬 Latest messages:");
  for (let i = Math.max(0, msgs.length - 15); i < msgs.length; i++) {
    try {
      const t = await msgs[i].textContent();
      if (t && t.trim().length > 2 && t.trim().length < 500) {
        console.log("  [" + i + "] " + t.trim().substring(0, 150));
      }
    } catch {}
  }

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
}
main().catch(console.error);
