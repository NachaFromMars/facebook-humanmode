import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("✈️ Check flight prices — VietJet + VN Airlines");

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });

  // Tab 1: Skyscanner — so sánh tất cả hãng
  const page1 = await context.newPage();
  console.log("📊 Tab 1: Skyscanner...");
  await page1.goto("https://www.skyscanner.com.vn/transport/flights/sgn/bkkt/260401/260402/?adults=3&cabinclass=economy&ref=home&rtn=1", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(8000, 12000);
  await page1.screenshot({ path: path.join(LOG_DIR, "flight-skyscanner.png") });
  console.log("  📸 Skyscanner screenshot saved");

  // Tab 2: Google Flights
  const page2 = await context.newPage();
  console.log("📊 Tab 2: Google Flights...");
  await page2.goto("https://www.google.com/travel/flights/search?tfs=CBwQAhopEgoyMDI2LTA0LTAxagwIAhIIL20vMGhuaHJyDAgCEggvbS8wZm4yeRopEgoyMDI2LTA0LTAyagwIAhIIL20vMGZuMnlyDAgCEggvbS8waG5ocnADcAF6CAgBEAASACAAeAFKAwoBMEABSAFwAYIBCwj___________8BGA&tfu=CnRDalJJUjFvd1EyeFNUVTlOY0VSQlEwRkJSMGRDUnkwdExTMHRMUzB0TFhCc2VXeFJRVUZCUjBKQkVoVktVekV5Tm50V1RpMUJTMVF0UVVWQ0VnSktVekUyTTN0V1RpMUJTMVF0UVVWQ0dnTklRVlE9EgA&hl=vi&gl=vn&curr=VND", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(8000, 12000);
  await page2.screenshot({ path: path.join(LOG_DIR, "flight-google.png") });
  console.log("  📸 Google Flights screenshot saved");

  // Tab 3: VietJet direct
  const page3 = await context.newPage();
  console.log("📊 Tab 3: VietJet...");
  await page3.goto("https://www.vietjetair.com/en/flight-tickets/flights-from-ho-chi-minh-city-to-bangkok", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(8000, 12000);
  await page3.screenshot({ path: path.join(LOG_DIR, "flight-vietjet.png") });
  console.log("  📸 VietJet screenshot saved");

  // Tab 4: Traveloka search
  const page4 = await context.newPage();
  console.log("📊 Tab 4: Traveloka...");
  await page4.goto("https://www.traveloka.com/vi-vn/flight/fullsearch?ap=SGN.BKK&dt=01-04-2026.02-04-2026&ps=3.0.0&sc=ECONOMY", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(10000, 14000);
  await page4.screenshot({ path: path.join(LOG_DIR, "flight-traveloka.png") });
  console.log("  📸 Traveloka screenshot saved");

  // Read any visible prices
  for (const [name, page] of [["Skyscanner", page1], ["Google", page2], ["Traveloka", page4]] as [string, any][]) {
    try {
      const priceText = await page.evaluate(() => {
        const body = document.body.textContent || "";
        const prices: string[] = [];
        const matches = body.match(/[\d,.]+\s*(VND|₫|đ|triệu|USD|\$|SGD)/gi);
        if (matches) prices.push(...matches.slice(0, 10));
        return prices.join(" | ");
      });
      console.log("  " + name + " prices: " + priceText);
    } catch {}
  }

  await browser.close();
  console.log("🔒 Done");
}
main().catch(console.error);
