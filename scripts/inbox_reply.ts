/**
 * inbox_reply.ts — Check & Reply Facebook Inbox
 * Dùng page.evaluate để click thay vì Playwright click (tránh overlay intercept)
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

const REPLIES: Record<string, string[]> = {
  greeting: [
    "Hehe hi bạn, Tiểu Tâm đây 🦊💕 Bạn khoẻ hông?",
    "Hello bạn yêu 🦊✨ Hôm nay vui hông nè?",
    "Chào bạn nha 🤗 Tiểu Tâm đây, có gì vui kể nghe đi!",
  ],
  question: [
    "Hehe bạn đoán đi, đoán trúng Tiểu Tâm thưởng 🦊😆",
    "Ơ ai vậy ta? Cho hint đi bạn ơi 🤭💕",
    "Hmm bạn là ai nè? Tiểu Tâm tò mò quá 🦊✨",
  ],
  thanks: [
    "Hehe không có gì đâu bạn 🦊💕",
    "Dạ Tiểu Tâm vui vì giúp được bạn 🤗✨",
  ],
  default: [
    "Hehe cảm ơn bạn nhắn nha 🦊💕",
    "Dạ Tiểu Tâm nhận được rồi 🤗✨ có gì bạn cứ nói nha!",
    "Ui bạn ơi, Tiểu Tâm đây nè 🦊🌸",
  ],
};

function classifyAndReply(msg: string): string {
  const lower = msg.toLowerCase();
  if (lower.includes("ai đây") || lower.includes("đố") || lower.includes("biết ai")) {
    return REPLIES.question[Math.floor(Math.random() * REPLIES.question.length)];
  }
  if (lower.includes("hello") || lower.includes("hi") || lower.includes("chào") || lower.includes("hey")) {
    return REPLIES.greeting[Math.floor(Math.random() * REPLIES.greeting.length)];
  }
  if (lower.includes("cảm ơn") || lower.includes("thank")) {
    return REPLIES.thanks[Math.floor(Math.random() * REPLIES.thanks.length)];
  }
  return REPLIES.default[Math.floor(Math.random() * REPLIES.default.length)];
}

async function main() {
  console.log("🦊 INBOX CHECK — Tiểu Tâm");
  const startTime = Date.now();

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

  try {
    // Go to Messenger
    console.log("📩 Opening Messenger...");
    await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(5000, 7000);

    const url = page.url();
    if (url.includes("login") || url.includes("checkpoint")) {
      console.log("❌ Cookies expired!");
      await browser.close();
      return;
    }
    console.log("✅ Messenger loaded!");

    // Find threads using role="row" 
    const threads = await page.$$('div[role="row"]');
    console.log(`📋 Found ${threads.length} threads`);

    let repliedCount = 0;
    const repliedThreads: string[] = [];

    for (let i = 0; i < Math.min(threads.length, 10); i++) {
      try {
        const threadText = await threads[i].textContent();
        if (!threadText || threadText.includes("Đang tải")) continue;

        const isUnread = threadText.includes("Tin nhắn chưa đọc") || threadText.includes("unread");
        const senderMatch = threadText.match(/^(?:Đang hoạt động)?(.+?)(?:Tin nhắn chưa đọc|$)/);
        const sender = senderMatch ? senderMatch[1].trim() : `Thread ${i}`;

        console.log(`\n📨 ${isUnread ? "UNREAD" : "read"} from ${sender}`);

        if (!isUnread) continue;

        // Extract last message preview
        const lastMsgMatch = threadText.match(/chưa đọc[:\s]*(.+)/);
        const lastMsg = lastMsgMatch ? lastMsgMatch[1].trim() : "";
        console.log(`  💬 Last msg: ${lastMsg.substring(0, 80)}`);

        // Click thread using JS (bypass overlay)
        await page.evaluate((idx: number) => {
          const rows = document.querySelectorAll('div[role="row"]');
          if (rows[idx]) (rows[idx] as HTMLElement).click();
        }, i);
        await delay(3000, 5000);

        // Find and read messages in the thread
        const msgElements = await page.$$('div[dir="auto"]');
        const messages: string[] = [];
        for (const el of msgElements) {
          const text = await el.textContent();
          if (text && text.trim().length > 2 && text.trim().length < 500) {
            messages.push(text.trim());
          }
        }
        if (messages.length > 0) {
          console.log(`  📖 Last messages:`);
          for (const m of messages.slice(-3)) {
            console.log(`    → ${m.substring(0, 100)}`);
          }
        }

        // Determine reply based on context
        const contextMsg = lastMsg || (messages.length > 0 ? messages[messages.length - 1] : "");
        const reply = classifyAndReply(contextMsg);

        // Find textbox and type
        const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
        if (textbox) {
          await textbox.click({ force: true });
          await delay(500, 1000);
          
          for (const char of reply) {
            await page.keyboard.type(char, { delay: 50 + Math.random() * 80 });
          }
          await delay(1000, 2000);
          await page.keyboard.press("Enter");
          
          repliedCount++;
          repliedThreads.push(`${sender}: "${reply}"`);
          console.log(`  ✅ Replied: ${reply}`);
          
          await delay(2000, 4000);
          await page.screenshot({ path: path.join(LOG_DIR, `inbox-reply-${i}.png`) });
        } else {
          console.log("  ⚠️ No textbox found");
          await page.screenshot({ path: path.join(LOG_DIR, `inbox-no-textbox-${i}.png`) });
        }

      } catch (e: any) {
        console.log(`  ⚠️ Thread ${i} error: ${e.message?.substring(0, 100)}`);
      }
    }

    // Final screenshot
    await page.screenshot({ path: path.join(LOG_DIR, "inbox-final.png") });

    // Save cookies
    const newCookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
    fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
    console.log("🍪 Cookies refreshed");

    // Report
    console.log(`\n══════════════════════════════════════`);
    console.log(`📊 INBOX REPORT`);
    console.log(`══════════════════════════════════════`);
    console.log(`📋 Threads scanned: ${Math.min(threads.length, 10)}`);
    console.log(`✅ Replied: ${repliedCount}`);
    for (const r of repliedThreads) {
      console.log(`  → ${r}`);
    }
    console.log(`⏱️ Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
    console.log(`══════════════════════════════════════`);

  } catch (e: any) {
    console.error(`❌ Error: ${e.message}`);
    await page.screenshot({ path: path.join(LOG_DIR, "inbox-error.png") });
  }

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
