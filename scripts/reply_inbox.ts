import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

async function humanType(page: any, text: string) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 80 });
    if (Math.random() < 0.04) await delay(200, 500);
  }
}

async function main() {
  console.log("🦊 REPLY INBOX — Tiểu Tâm");

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

  // Known threads from scan
  const threads = [
    { name: "Thích Minh Không", id: "61565220397919", unread: true, lastMsg: "Hello Tiểu Tâm, đố biết ai đây" },
    { name: "Hieu Nguyen", id: null, unread: false, lastMsg: "" },
    { name: "Mình Đức Đức", id: null, unread: false, lastMsg: "" },
  ];

  const replies: any[] = [];

  for (const thread of threads) {
    if (!thread.id) continue;

    console.log(`\n═══ Thread: ${thread.name} ═══`);
    console.log(`  📩 Last msg: "${thread.lastMsg}"`);

    // Navigate directly to thread
    const threadUrl = `https://www.facebook.com/messages/t/${thread.id}/`;
    console.log(`  🌐 Going to ${threadUrl}`);
    await page.goto(threadUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(4000, 6000);

    await page.screenshot({ path: path.join(LOG_DIR, `inbox-${thread.name.replace(/\s/g, '_')}.png`) });
    console.log(`  📸 Screenshot`);

    // Read last messages
    const allText = await page.$$eval('div[dir="auto"]', (els: any[]) => 
      els.map((e: any) => e.textContent?.trim()).filter((t: any) => t && t.length > 2 && t.length < 500)
    );
    console.log(`  💬 Found ${allText.length} text elements`);
    const lastMsgs = allText.slice(-5);
    for (const m of lastMsgs) {
      console.log(`    → ${m.substring(0, 100)}`);
    }

    // Find textbox and reply
    const textboxSelectors = [
      'div[role="textbox"][contenteditable="true"]',
      'div[aria-label*="Nhắn tin"]',
      'div[aria-label*="Aa"]',
      'div[contenteditable="true"]',
    ];

    let replied = false;
    for (const sel of textboxSelectors) {
      const box = await page.$(sel);
      if (box) {
        console.log(`  ✅ Found textbox: ${sel}`);
        
        // Use JS to focus (bypass overlay)
        await page.evaluate((s: string) => {
          const el = document.querySelector(s) as HTMLElement;
          if (el) { el.focus(); el.click(); }
        }, sel);
        await delay(800, 1500);

        // Generate contextual reply
        let reply = "";
        if (thread.lastMsg.includes("đố biết ai đây")) {
          reply = "Hehe bạn ơi, Tiểu Tâm đoán hoài mà hông ra 🦊🤔 Cho gợi ý đi bạn ơi! 💕";
        } else if (thread.lastMsg.includes("hello") || thread.lastMsg.includes("hi") || thread.lastMsg.includes("Hello")) {
          reply = "Hello bạn nè 🦊👋 Hôm nay bạn khoẻ hông?";
        } else {
          reply = "Hehe hi bạn, Tiểu Tâm đây 🦊💕 Có gì vui kể nghe đi!";
        }

        await humanType(page, reply);
        await delay(1000, 2000);
        await page.keyboard.press("Enter");
        console.log(`  ✅ SENT: "${reply}"`);
        replied = true;

        await delay(2000, 4000);
        await page.screenshot({ path: path.join(LOG_DIR, `inbox-replied-${thread.name.replace(/\s/g, '_')}.png`) });
        console.log(`  📸 Screenshot after reply`);

        replies.push({ name: thread.name, reply, status: "sent" });
        break;
      }
    }

    if (!replied) {
      console.log(`  ⚠️ Could not find textbox to reply`);
      replies.push({ name: thread.name, reply: "", status: "no_textbox" });
    }

    await delay(3000, 5000);
  }

  // Now try to discover other threads by visiting messenger root
  console.log("\n═══ Checking other threads ═══");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);

  // Get all thread links
  const threadLinks = await page.$$eval('a[href*="/messages/t/"]', (els: any[]) =>
    els.map((e: any) => ({
      href: e.getAttribute("href"),
      text: e.textContent?.trim().substring(0, 80),
    }))
  );
  console.log(`📋 All threads found: ${threadLinks.length}`);
  for (const t of threadLinks.slice(0, 10)) {
    console.log(`  → ${t.text} | ${t.href}`);
  }

  // Save cookies
  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  const sessionPath = path.join(__dirname, "..", "data", "cookies", "session.json");
  fs.writeFileSync(sessionPath, JSON.stringify(newCookies, null, 2));
  console.log("\n🍪 Cookies refreshed & saved");

  // Report
  console.log("\n🦊 ═══════════════════════════════════════");
  console.log("📊 INBOX REPORT");
  console.log("🦊 ═══════════════════════════════════════");
  for (const r of replies) {
    console.log(`  ${r.status === "sent" ? "✅" : "❌"} ${r.name}: ${r.reply || "failed"}`);
  }
  console.log("🦊 ═══════════════════════════════════════");

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
