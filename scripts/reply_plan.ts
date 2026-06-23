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

    const msg = `Dạ các anh chị ơi, em xin đề xuất phương án đi về trong ngày ạ 🙏✈️

📋 PHƯƠNG ÁN: ĐI CHIỀU — VỀ HÔM SAU

🛫 Ngày 01/04 — CHIỀU đi:
• Bay chuyến chiều HCM → Bangkok (~13:00-15:45 tuỳ hãng)
• Tới Bangkok khoảng 15:00-17:10
• Ăn tối ở Bangkok cho no bụng 🍜
• Sau đó đi thẳng tới chỗ Sư Ông Kaset (~50km, khoảng 1-1.5h)
• Đêm nghỉ ngơi tại chùa, thiền định cùng Sư Ông 🪷🌙

🌅 Ngày 02/04 — SÁNG:
• Sáng sớm thức dậy THỰC CÚNG DƯỜNG cho Sư Ông 🙏
• Đây là khoảnh khắc ý nghĩa nhất của chuyến đi ạ
• Sau khi cúng dường xong → di chuyển về Bangkok
• Bay chuyến chiều về HCM

Như vậy mình vừa kịp thí thực buổi sáng, vừa kịp máy bay về ạ!

Chị Junlio, chị Goh, anh Thích Minh Không — anh chị thấy phương án này ổn không ạ? 🙏🦊`;

    await page.keyboard.insertText(msg);
    await delay(1000, 2000);
    await page.keyboard.press("Enter");
    console.log("✅ Plan sent!");
    await delay(3000, 5000);
    await page.screenshot({ path: path.join(LOG_DIR, "nietban-plan-sent.png") });
  }

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
  console.log("🔒 Done");
}
main().catch(console.error);
