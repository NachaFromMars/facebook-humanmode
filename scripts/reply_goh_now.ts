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

  const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
  if (textbox && await textbox.isVisible()) {
    await textbox.click({ force: true });
    await delay(500, 1000);

    const msg = `Dạ chị Goh ơi 🙏💕

Em xin cập nhật nha:
Chuyến sớm nhất ngày 01/04 từ HCM đi Bangkok giá tốt nhất là VietJet ạ:
✈️ VietJet 8:35 sáng → 10:05 (1h30, bay thẳng) — ~6.7tr/người

Dạ chị hỏi chuyến chiều cũng có ạ:
🌅 VietJet 13:00 → 14:30 — giá tương đương
🌇 Thai Airways 15:45 → 17:10 — ~7.1tr/người

Về ngày 02/04 — chị nói không cần trễ nhất, vậy em tìm chuyến chiều vừa phải nha:
🔙 VietJet ~14:00-15:00 về HCM ~16:30-17:30

Dạ vậy lịch trình sẽ là:
📅 01/04 sáng bay đi → chiều tối đến chỗ Sư Ông Kaset
🌙 Ngủ lại đêm tại chùa (có 4 túp lều gỗ)
📅 02/04 sáng cúng dường → trưa ra sân bay → chiều về HCM

Anh Thích Minh Không và anh Junlio ơi, anh chị chốt hãng VietJet luôn nha, ngon bổ rẻ nhất rồi ạ! 🙏✈️`;

    await page.keyboard.insertText(msg);
    await delay(1000, 2000);
    await page.keyboard.press("Enter");
    console.log("✅ Reply sent!");
    await delay(3000, 5000);
    await page.screenshot({ path: path.join(LOG_DIR, "nietban-reply-all-done.png") });
  }

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
  console.log("🔒 Done");
}
main().catch(console.error);
