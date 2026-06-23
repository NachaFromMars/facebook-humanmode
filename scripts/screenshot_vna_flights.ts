import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function main() {
  console.log("✈️ Screenshot VNA flights BKK→SGN 02/04 chiều + tối");

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });

  // --- Screenshot 1: Traveloka VNA flights ---
  const page = await context.newPage();
  console.log("📊 Traveloka — BKK→SGN 02/04...");
  await page.goto("https://www.traveloka.com/vi-vn/flight/fullsearch?ap=BKK.SGN&dt=02-04-2026&ps=3.0.0&sc=ECONOMY", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(15000);
  
  // Screenshot full results first
  await page.screenshot({ path: path.join(LOG_DIR, "traveloka-all-flights.png"), fullPage: false });
  console.log("📸 Traveloka all flights");

  // Try to filter Vietnam Airlines
  try {
    // Look for airline filter
    const filters = await page.$$('label, span, div');
    for (const el of filters) {
      const text = await el.textContent();
      if (text && text.includes('Vietnam Airlines') && text.length < 30) {
        console.log("Found VNA filter:", text);
        await el.click();
        await delay(5000);
        break;
      }
    }
  } catch(e) { console.log("Filter attempt:", e); }

  await page.screenshot({ path: path.join(LOG_DIR, "traveloka-vna-filtered.png"), fullPage: false });
  console.log("📸 Traveloka VNA filtered");

  // Scroll down for more flights
  await page.evaluate(() => window.scrollBy(0, 600));
  await delay(3000);
  await page.screenshot({ path: path.join(LOG_DIR, "traveloka-vna-scroll.png"), fullPage: false });
  console.log("📸 Traveloka scrolled");

  // --- Screenshot 2: Google Flights ---
  const page2 = await context.newPage();
  console.log("📊 Google Flights — BKK→SGN 02/04 VNA only...");
  await page2.goto("https://www.google.com/travel/flights?q=Vietnam+Airlines+flights+from+Bangkok+to+Ho+Chi+Minh+City+on+April+2+2026&curr=VND&hl=vi", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(12000);
  await page2.screenshot({ path: path.join(LOG_DIR, "google-flights-vna-1.png"), fullPage: false });
  console.log("📸 Google Flights 1");

  await page2.evaluate(() => window.scrollBy(0, 400));
  await delay(3000);
  await page2.screenshot({ path: path.join(LOG_DIR, "google-flights-vna-2.png"), fullPage: false });
  console.log("📸 Google Flights 2");

  // --- Screenshot 3: VNA official website ---
  const page3 = await context.newPage();
  console.log("📊 Vietnam Airlines official...");
  await page3.goto("https://www.vietnamairlines.com/vn/vi/home", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(8000);
  
  // Try one-way search BKK→SGN
  try {
    // Click one-way
    const oneWay = await page3.$('text=Một chiều');
    if (oneWay) {
      await oneWay.click();
      await delay(1000);
      console.log("Clicked one-way");
    }
  } catch(e) { console.log("One-way click err"); }
  
  await page3.screenshot({ path: path.join(LOG_DIR, "vna-official.png"), fullPage: false });
  console.log("📸 VNA official");

  await browser.close();
  console.log("\n🔒 Done — screenshots saved to", LOG_DIR);
}
main().catch(console.error);
