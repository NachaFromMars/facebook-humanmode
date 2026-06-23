import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("✈️ Check VietJet price — SGN→BKK 01/04, return 02/04, 3 adults");

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });

  const page = await context.newPage();

  // Try Traveloka with VietJet filter
  console.log("📊 Traveloka — VietJet search...");
  await page.goto("https://www.traveloka.com/vi-vn/flight/fullsearch?ap=SGN.BKK&dt=01-04-2026.02-04-2026&ps=3.0.0&sc=ECONOMY", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(12000, 15000);
  
  // Screenshot initial results
  await page.screenshot({ path: path.join(LOG_DIR, "vietjet-traveloka-1.png") });
  console.log("📸 Screenshot 1 saved");

  // Try to click VietJet filter
  try {
    const vietjetFilter = await page.locator('text=VietJet').first();
    if (await vietjetFilter.isVisible()) {
      await vietjetFilter.click();
      console.log("✅ Clicked VietJet filter");
      await delay(5000, 7000);
      await page.screenshot({ path: path.join(LOG_DIR, "vietjet-traveloka-filtered.png") });
      console.log("📸 Filtered screenshot saved");
    }
  } catch {}

  // Read prices
  const prices = await page.evaluate(() => {
    const body = document.body.textContent || "";
    const matches = body.match(/[\d,.]+\s*(VND|đ)/gi);
    return matches ? matches.slice(0, 20) : [];
  });
  console.log("Traveloka prices: " + prices.join(" | "));

  // Scroll down to see more results
  await page.evaluate(() => window.scrollBy(0, 600));
  await delay(3000, 5000);
  await page.screenshot({ path: path.join(LOG_DIR, "vietjet-traveloka-2.png") });
  console.log("📸 Screenshot 2 saved");

  // Also try Google Flights specifically for VietJet
  const page2 = await context.newPage();
  console.log("\n📊 Google Flights...");
  await page2.goto("https://www.google.com/travel/flights?q=VietJet+flights+from+SGN+to+BKK+on+April+1+2026+return+April+2+2026+3+adults&curr=VND&hl=vi", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(10000, 12000);
  await page2.screenshot({ path: path.join(LOG_DIR, "vietjet-google.png") });
  console.log("📸 Google Flights screenshot saved");

  const gPrices = await page2.evaluate(() => {
    const body = document.body.textContent || "";
    const matches = body.match(/[\d,.]+\s*(₫|VND|đ)/gi);
    return matches ? matches.slice(0, 15) : [];
  });
  console.log("Google prices: " + gPrices.join(" | "));

  // Try Skyscanner
  const page3 = await context.newPage();
  console.log("\n📊 Skyscanner...");
  await page3.goto("https://www.skyscanner.com.vn/transport/flights/sgn/bkkt/260401/260402/?adults=3&cabinclass=economy&ref=home&rtn=1&preferdirects=false", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(10000, 12000);
  await page3.screenshot({ path: path.join(LOG_DIR, "vietjet-skyscanner.png") });
  console.log("📸 Skyscanner screenshot saved");

  await browser.close();
  console.log("🔒 Done");
}
main().catch(console.error);
