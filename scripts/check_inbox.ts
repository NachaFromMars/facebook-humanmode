import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("🦊 CHECK INBOX — Tiểu Tâm");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Load cookies
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  console.log(`🍪 Loaded ${cookies.length} cookies`);

  const page = await context.newPage();

  // Go to Messenger
  console.log("📩 Navigating to Messenger...");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  const url = page.url();
  console.log(`📍 URL: ${url}`);

  if (url.includes("login") || url.includes("checkpoint")) {
    console.log("❌ Cookies expired!");
    await browser.close();
    return;
  }

  await page.screenshot({ path: path.join(LOG_DIR, "inbox-overview.png") });
  console.log("📸 Screenshot inbox overview");

  // Get page content to understand structure
  const pageText = await page.textContent("body");
  console.log(`📄 Page text (first 300): ${(pageText || "").substring(0, 300)}`);

  // Look for chat threads
  const threadSelectors = [
    'a[href*="/messages/t/"]',
    'div[role="row"]',
    'div[role="listitem"]',
    'div[data-testid="mwthreadlist-item"]',
  ];

  for (const sel of threadSelectors) {
    const items = await page.$$(sel);
    if (items.length > 0) {
      console.log(`\n🔍 Found ${items.length} items with: ${sel}`);
      for (let i = 0; i < Math.min(items.length, 8); i++) {
        const text = await items[i].textContent();
        const href = await items[i].getAttribute("href");
        console.log(`  [${i}] ${(text || "").substring(0, 80).replace(/\n/g, " ")} ${href ? `→ ${href}` : ""}`);
      }
    }
  }

  // Try clicking first thread
  console.log("\n🖱️ Trying to click first conversation...");
  const firstThread = await page.$('a[href*="/messages/t/"]');
  if (firstThread) {
    await firstThread.click();
    await delay(3000, 5000);
    await page.screenshot({ path: path.join(LOG_DIR, "inbox-thread1.png") });
    console.log("📸 Screenshot first thread");

    const threadUrl = page.url();
    console.log(`📍 Thread URL: ${threadUrl}`);

    // Read messages in thread
    const msgSelectors = [
      'div[dir="auto"]',
      'div[data-ad-preview="message"]',
      'div[role="row"] div[dir="auto"]',
    ];

    for (const sel of msgSelectors) {
      const msgs = await page.$$(sel);
      if (msgs.length > 3) {
        console.log(`\n💬 Messages (${sel}): ${msgs.length}`);
        // Show last 5 messages
        for (let i = Math.max(0, msgs.length - 5); i < msgs.length; i++) {
          const text = await msgs[i].textContent();
          if (text && text.trim().length > 2 && text.trim().length < 500) {
            console.log(`  MSG[${i}]: ${text.trim().substring(0, 100)}`);
          }
        }
        break;
      }
    }

    // Find message input box
    const inputSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[aria-label*="Nhắn tin"]',
      'div[aria-label*="Message"]',
      'div[aria-label*="Aa"]',
      'p[class*="placeholder"]',
    ];

    let inputFound = false;
    for (const sel of inputSelectors) {
      const input = await page.$(sel);
      if (input) {
        console.log(`\n✅ Found input: ${sel}`);
        inputFound = true;

        // Type and send reply
        await input.click();
        await delay(500, 1000);

        const reply = "Hehe hi bạn, Tiểu Tâm đây 🦊💕 Hôm nay bạn khoẻ hông?";
        for (const char of reply) {
          await page.keyboard.type(char, { delay: 50 + Math.random() * 80 });
        }
        await delay(1000, 2000);
        await page.keyboard.press("Enter");
        console.log(`✅ Sent reply: ${reply}`);
        await delay(2000, 4000);
        await page.screenshot({ path: path.join(LOG_DIR, "inbox-replied.png") });
        console.log("📸 Screenshot after reply");
        break;
      }
    }

    if (!inputFound) {
      console.log("⚠️ No message input found");
    }
  } else {
    console.log("⚠️ No thread links found");

    // Try alternative: click on conversation areas
    const rows = await page.$$('div[role="row"], div[role="gridcell"]');
    console.log(`🔍 Found ${rows.length} row elements`);
    if (rows.length > 0) {
      await rows[0].click();
      await delay(3000, 5000);
      await page.screenshot({ path: path.join(LOG_DIR, "inbox-alt-click.png") });
      console.log("📸 Screenshot after alt click");
    }
  }

  // Save refreshed cookies
  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  const sessionPath = path.join(__dirname, "..", "data", "cookies", "session.json");
  fs.writeFileSync(sessionPath, JSON.stringify(newCookies, null, 2));
  console.log("🍪 Cookies refreshed & saved");

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
