import { chromium } from "playwright";
import * as fs from "node:fs";

const COOKIE_PATH = "./data/cookies.json";
const PROFILE_URL = "https://www.facebook.com/profile.php?id=61588560594683";

async function main() {
  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled","--no-sandbox"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);

  const page = await context.newPage();
  await page.goto(PROFILE_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
  await new Promise(r => setTimeout(r, 8000));

  console.log("URL:", page.url());
  await page.screenshot({ path: "./data/logs/debug-pipeline-profile.png", fullPage: false });

  // Find all visible text
  const texts = await page.evaluate(() => {
    const result: string[] = [];
    document.querySelectorAll("span, a").forEach(el => {
      const t = (el as HTMLElement).innerText?.trim();
      if (t && t.length > 2 && t.length < 80 && (el as HTMLElement).offsetHeight > 0) {
        result.push(t.substring(0, 60));
      }
    });
    return [...new Set(result)].slice(0, 50);
  });
  console.log("Visible texts:", JSON.stringify(texts, null, 2));

  // Look for composer-like elements
  const composerInfo = await page.evaluate(() => {
    const results: string[] = [];
    const all = document.querySelectorAll("*");
    for (let i = 0; i < all.length; i++) {
      const el = all[i] as HTMLElement;
      const t = el.innerText?.trim() || "";
      const al = el.getAttribute("aria-label") || "";
      const ph = el.getAttribute("placeholder") || "";
      const role = el.getAttribute("role") || "";
      if (
        t.includes("nghĩ gì") || t.includes("your mind") ||
        al.includes("nghĩ gì") || al.includes("Tạo bài") || al.includes("Create post") ||
        ph.includes("nghĩ")
      ) {
        results.push(`<${el.tagName} role="${role}" aria="${al.substring(0,30)}" text="${t.substring(0,30)}">`);
      }
    }
    return results.slice(0, 10);
  });
  console.log("Composer elements:", composerInfo);

  // Also check for role=button elements
  const buttons = await page.evaluate(() => {
    const results: string[] = [];
    document.querySelectorAll('[role="button"]').forEach(el => {
      const t = (el as HTMLElement).innerText?.trim() || "";
      const al = (el as HTMLElement).getAttribute("aria-label") || "";
      if (t.length > 0 && t.length < 40 && (el as HTMLElement).offsetHeight > 0) {
        results.push(`btn: "${t}" aria="${al}"`);
      }
    });
    return [...new Set(results)].slice(0, 20);
  });
  console.log("Buttons:", JSON.stringify(buttons, null, 2));

  await browser.close();
}
main().catch(console.error);
