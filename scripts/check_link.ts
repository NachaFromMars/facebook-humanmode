import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

const URL = process.env.CHECK_URL || "";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });
  const page = await context.newPage();

  console.log("Opening: " + URL);
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(8000, 12000);

  // Read prices
  const priceText = await page.evaluate(() => {
    const body = document.body.textContent || "";
    const prices: string[] = [];
    const matches = body.match(/[\d,.]+\s*(VND|₫|đ)/gi);
    if (matches) prices.push(...matches.slice(0, 15));
    return prices.join(" | ");
  });
  console.log("Prices found: " + priceText);

  // Get page text for context
  const pageText = await page.evaluate(() => document.body.innerText.substring(0, 2000));
  console.log("Page text: " + pageText.substring(0, 500));

  await page.screenshot({ path: path.join(LOG_DIR, "check-link.png") });
  console.log("Screenshot saved");

  await browser.close();
}
main().catch(console.error);
