import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

const IMAGE_PATH = process.env.IMAGE || path.join(LOG_DIR, "flight-traveloka.png");
const CAPTION = process.env.CAPTION || "";

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

  // Type caption first
  const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
  if (textbox && await textbox.isVisible()) {
    if (CAPTION) {
      await textbox.click({ force: true });
      await delay(500, 1000);
      await page.keyboard.insertText(CAPTION);
      await delay(500, 1000);
    }

    // Find file input for image attachment
    const fileInputs = await page.$$('input[type="file"]');
    console.log("File inputs found: " + fileInputs.length);
    
    let uploaded = false;
    for (const fi of fileInputs) {
      const accept = await fi.getAttribute("accept");
      console.log("  accept: " + accept);
      if (accept && (accept.includes("image") || accept.includes("*"))) {
        await fi.setInputFiles(IMAGE_PATH);
        uploaded = true;
        console.log("✅ Image uploaded: " + path.basename(IMAGE_PATH));
        await delay(3000, 5000);
        break;
      }
    }

    if (!uploaded) {
      // Try clicking attachment button first
      const attachBtns = await page.$$('div[aria-label*="Đính kèm"], div[aria-label*="Attach"], div[aria-label*="file"], div[aria-label*="Thêm"]');
      console.log("Attach buttons: " + attachBtns.length);
      for (const btn of attachBtns) {
        if (await btn.isVisible()) {
          await btn.click();
          console.log("Clicked attach button");
          await delay(2000, 3000);
          
          const fileInputs2 = await page.$$('input[type="file"]');
          for (const fi2 of fileInputs2) {
            const accept = await fi2.getAttribute("accept");
            if (accept && (accept.includes("image") || accept.includes("*"))) {
              await fi2.setInputFiles(IMAGE_PATH);
              uploaded = true;
              console.log("✅ Image uploaded via attach button");
              await delay(3000, 5000);
              break;
            }
          }
          break;
        }
      }
    }

    // Send
    await page.keyboard.press("Enter");
    console.log("✅ Sent!");
    await delay(3000, 5000);
    await page.screenshot({ path: path.join(LOG_DIR, "nietban-image-sent.png") });
  }

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
}
main().catch(console.error);
