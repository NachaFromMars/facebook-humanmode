import { chromium } from "playwright";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

async function main() {
  console.log("✈️ Check Vietnam Airlines BKK→SGN 02/04/2026 — ALL flights");

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });

  const page = await context.newPage();

  // VNA website - book one-way BKK→SGN 02/04
  console.log("📊 Vietnam Airlines website...");
  await page.goto("https://www.vietnamairlines.com/vn/vi/home", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000);
  
  // Try direct booking URL
  const page2 = await context.newPage();
  console.log("📊 VNA booking page...");
  await page2.goto("https://www.vietnamairlines.com/vn/vi/booking/booking-start?roundTrip=0&leg0Origin=BKK&leg0Destination=SGN&leg0DepartureDate=2026-04-02&numAdults=3&numChildren=0&numInfants=0&cabinClass=economy", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(8000);
  await page2.screenshot({ path: path.join(LOG_DIR, "vna-direct-booking.png"), fullPage: false });
  console.log("📸 VNA direct booking screenshot");

  // Google Flights - specifically Vietnam Airlines only
  const page3 = await context.newPage();
  console.log("📊 Google Flights — Vietnam Airlines only BKK→SGN 02/04...");
  await page3.goto("https://www.google.com/travel/flights/search?tfs=CBwQAhooEgoyMDI2LTA0LTAyagwIAhIIL20vMGZuMmtyDAoCEggvbS8waHFseRgBcAGCAQsI____________AUABSAGYAQFQARgB&hl=vi&gl=vn&curr=VND", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(10000);
  await page3.screenshot({ path: path.join(LOG_DIR, "vna-google-flights-1.png"), fullPage: false });
  
  // Scroll and capture more
  await page3.evaluate(() => window.scrollBy(0, 600));
  await delay(3000);
  await page3.screenshot({ path: path.join(LOG_DIR, "vna-google-flights-2.png"), fullPage: false });

  // Extract ALL flight data
  const bodyText = await page3.evaluate(() => document.body.innerText);
  console.log("\n📋 FULL page text (flight related):");
  const allLines = bodyText.split("\n");
  allLines.forEach((l: string, i: number) => {
    const t = l.trim();
    if (t.length > 0 && t.length < 150) {
      console.log(`  [${i}] ${t}`);
    }
  });

  // Also try Traveloka filter Vietnam Airlines
  const page4 = await context.newPage();
  console.log("\n📊 Traveloka — BKK→SGN 02/04 filter VNA...");
  await page4.goto("https://www.traveloka.com/vi-vn/flight/fullsearch?ap=BKK.SGN&dt=02-04-2026&ps=3.0.0&sc=ECONOMY", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(15000);
  
  // Try to filter Vietnam Airlines
  try {
    const vnaFilter = await page4.locator('text=Vietnam Airlines').first();
    if (await vnaFilter.isVisible({ timeout: 5000 })) {
      await vnaFilter.click();
      console.log("✅ Clicked Vietnam Airlines filter");
      await delay(5000);
    }
  } catch { console.log("❌ VNA filter not found"); }
  
  await page4.screenshot({ path: path.join(LOG_DIR, "vna-traveloka-filtered.png"), fullPage: false });
  console.log("📸 Traveloka VNA filtered screenshot");

  // Extract flight times
  const tBody = await page4.evaluate(() => document.body.innerText);
  const tLines = tBody.split("\n").filter((l: string) => {
    return /\d{1,2}:\d{2}/.test(l) || l.toLowerCase().includes("vietnam") || l.toLowerCase().includes("vn ");
  });
  console.log("\n📋 Traveloka flights:");
  tLines.slice(0, 40).forEach((l: string, i: number) => console.log(`  [${i}] ${l.trim().substring(0, 150)}`));

  await browser.close();
  console.log("\n🔒 Done");
}
main().catch(console.error);
