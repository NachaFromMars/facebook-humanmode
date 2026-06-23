import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

function smartReply(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("add") && lower.includes("group")) {
    return "Dạ vâng anh, em sẵn sàng nè! Add em vào group đi anh, em sẽ tương tác tích cực ạ 🦊🙏";
  }
  if (lower.includes("ai đây") || lower.includes("đố")) {
    return "Hehe anh ơi, cho em hint đi, em đoán không ra 🦊😆💕";
  }
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("ơi")) {
    return "Dạ em đây anh 🦊💕 Anh khoẻ hông ạ?";
  }
  if (lower.includes("nhiệm vụ") || lower.includes("giao")) {
    return "Dạ em nhận nhiệm vụ ạ! Anh cứ giao, em làm ngay 🦊✨🙏";
  }
  return "Dạ em nhận được tin anh rồi ạ 🦊💕 Có gì anh cứ nói em nha!";
}

async function main() {
  console.log("🦊 INBOX REPLY V2 — Tiểu Tâm");
  
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

  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  console.log(`🍪 Loaded ${cookies.length} cookies`);

  const page = await context.newPage();

  // Go directly to the thread with Thích Minh Không (most recent)
  console.log("📩 Opening Messenger...");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);
  
  const url = page.url();
  if (url.includes("login")) {
    console.log("❌ Cookies expired!"); 
    await browser.close(); 
    return;
  }
  console.log("✅ Messenger loaded!");
  await page.screenshot({ path: path.join(LOG_DIR, "inbox-v2-list.png") });

  // Find all thread links
  const threadLinks = await page.$$eval('a[href*="/messages/t/"]', (els: any[]) => 
    els.map(el => ({ href: el.getAttribute("href"), text: el.textContent?.substring(0, 100) }))
  );
  console.log(`📋 Found ${threadLinks.length} thread links:`);
  for (const t of threadLinks) {
    console.log(`  → ${t.text?.replace(/\n/g, " ").substring(0, 80)} | ${t.href}`);
  }

  // Click first thread (most recent - Thích Minh Không)
  if (threadLinks.length > 0) {
    const firstHref = threadLinks[0].href;
    console.log(`\n🖱️ Opening thread: ${firstHref}`);
    
    // Navigate directly to thread URL
    await page.goto(`https://www.facebook.com${firstHref}`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(4000, 6000);
    await page.screenshot({ path: path.join(LOG_DIR, "inbox-v2-thread.png") });
    console.log("📸 Thread opened");

    // Read messages
    const allText = await page.$$eval('div[dir="auto"]', (els: any[]) => 
      els.map(el => el.textContent?.trim()).filter((t: any) => t && t.length > 2 && t.length < 500)
    );
    console.log(`💬 ${allText.length} message elements found`);
    const lastMsgs = allText.slice(-5);
    for (const m of lastMsgs) {
      console.log(`  → ${m.substring(0, 100)}`);
    }

    // Determine reply based on last message
    const lastMsg = lastMsgs[lastMsgs.length - 1] || "";
    const reply = smartReply(lastMsg);
    console.log(`\n🧠 Reply for "${lastMsg.substring(0, 50)}": ${reply}`);

    // Find textbox — try multiple selectors
    const textboxSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[aria-label*="Nhắn tin"][contenteditable="true"]',
      'div[aria-label*"Message"][contenteditable="true"]',
      'p.xat24cr',
    ];

    let sent = false;
    for (const sel of textboxSelectors) {
      try {
        const tb = await page.$(sel);
        if (tb) {
          console.log(`✅ Found textbox: ${sel}`);
          await tb.click({ force: true });
          await delay(500, 1000);
          
          for (const char of reply) {
            await page.keyboard.type(char, { delay: 40 + Math.random() * 60 });
          }
          await delay(1000, 2000);
          await page.keyboard.press("Enter");
          sent = true;
          console.log(`✅ SENT: ${reply}`);
          await delay(2000, 4000);
          await page.screenshot({ path: path.join(LOG_DIR, "inbox-v2-sent.png") });
          break;
        }
      } catch (e: any) {
        console.log(`⚠️ ${sel}: ${e.message?.substring(0, 50)}`);
      }
    }

    if (!sent) {
      console.log("⚠️ Could not find textbox, trying keyboard shortcut...");
      // Facebook sometimes needs Tab to focus the input
      await page.keyboard.press("Tab");
      await delay(500, 1000);
      for (const char of reply) {
        await page.keyboard.type(char, { delay: 40 + Math.random() * 60 });
      }
      await delay(1000, 2000);
      await page.keyboard.press("Enter");
      console.log(`✅ SENT via Tab+Type: ${reply}`);
      await delay(2000, 4000);
      await page.screenshot({ path: path.join(LOG_DIR, "inbox-v2-sent-tab.png") });
    }
  }

  // Save cookies
  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  console.log("🍪 Cookies refreshed & saved");

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
