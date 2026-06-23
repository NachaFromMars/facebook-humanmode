import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("✈️ Check VNA BKK→SGN 02/04/2026 — earliest flight");

  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });

  const page = await context.newPage();

  // Google Flights - BKK to SGN on April 2
  console.log("📊 Google Flights — BKK→SGN 02/04...");
  await page.goto("https://www.google.com/travel/flights?q=flights+from+BKK+to+SGN+on+April+2+2026&curr=VND&hl=vi", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(10000, 12000);
  await page.screenshot({ path: path.join(LOG_DIR, "vna-return-google-1.png"), fullPage: false });
  console.log("📸 Google Flights screenshot 1");

  // Scroll down
  await page.evaluate(() => window.scrollBy(0, 500));
  await delay(3000, 4000);
  await page.screenshot({ path: path.join(LOG_DIR, "vna-return-google-2.png"), fullPage: false });
  console.log("📸 Google Flights screenshot 2");

  // Extract text
  const bodyText = await page.evaluate(() => document.body.innerText);
  // Search for flight times
  const lines = bodyText.split("\n").filter((l: string) => {
    const lower = l.toLowerCase();
    return lower.includes("vn") || lower.includes("vietnam") || lower.includes("vietjet") || 
           lower.includes("bkk") || lower.includes("sgn") || lower.includes("sáng") ||
           lower.includes(":") && /\d{1,2}:\d{2}/.test(l) ||
           lower.includes("₫") || lower.includes("vnd");
  });
  console.log("\n📋 Relevant lines:");
  lines.slice(0, 30).forEach((l: string, i: number) => console.log(`  [${i}] ${l.trim().substring(0, 120)}`));

  // Also try Traveloka one-way BKK→SGN 02/04
  const page2 = await context.newPage();
  console.log("\n📊 Traveloka — BKK→SGN 02/04...");
  await page2.goto("https://www.traveloka.com/vi-vn/flight/fullsearch?ap=BKK.SGN&dt=02-04-2026&ps=3.0.0&sc=ECONOMY", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(12000, 15000);
  await page2.screenshot({ path: path.join(LOG_DIR, "vna-return-traveloka-1.png"), fullPage: false });
  console.log("📸 Traveloka screenshot 1");

  // Scroll
  await page2.evaluate(() => window.scrollBy(0, 500));
  await delay(3000, 5000);
  await page2.screenshot({ path: path.join(LOG_DIR, "vna-return-traveloka-2.png"), fullPage: false });
  console.log("📸 Traveloka screenshot 2");

  const bodyText2 = await page2.evaluate(() => document.body.innerText);
  const lines2 = bodyText2.split("\n").filter((l: string) => {
    const lower = l.toLowerCase();
    return lower.includes("vietnam") || lower.includes("vietjet") || lower.includes("vn ") ||
           /\d{1,2}:\d{2}/.test(l) || lower.includes("₫") || lower.includes("vnd") ||
           lower.includes("sáng") || lower.includes("chiều");
  });
  console.log("\n📋 Traveloka relevant lines:");
  lines2.slice(0, 30).forEach((l: string, i: number) => console.log(`  [${i}] ${l.trim().substring(0, 120)}`));

  await browser.close();
  console.log("\n🔒 Done");
}
main().catch(console.error);
