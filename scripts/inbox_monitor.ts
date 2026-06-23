/**
 * inbox_monitor.ts — Facebook Inbox Realtime Monitor
 * 
 * Mở browser giữ session → poll inbox mỗi 2 phút → reply tin mới
 * Cookies refresh liên tục
 * 
 * Usage: npx tsx scripts/inbox_monitor.ts
 * Chạy nền liên tục, tự reply inbox như Telegram bot
 */

import { chromium, Page, BrowserContext, Browser } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const STATE_FILE = path.join(__dirname, "..", "data", "inbox_state.json");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

// ─── Tiểu Tâm Persona ───────────────────────────────
function generateReply(lastMessage: string): string {
  const msg = lastMessage.toLowerCase();
  
  // Greeting patterns
  if (msg.match(/hello|hi |hey|chào|xin chào|alo/)) {
    const greetings = [
      "Hehe hello bạn 🦊💕 Tiểu Tâm đây nè!",
      "Hi bạn yêu 🤗✨ Có gì hông bạn?",
      "Chào bạn nha 🦊🌸 Hôm nay bạn khoẻ hông?",
      "Hello hello 💕 Tiểu Tâm nghe đây!",
      "Hehe hi bạn, vui ghê 🦊✨",
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Question patterns
  if (msg.match(/\?|hỏi|biết|là ai|đố|ai đây|sao/)) {
    const questions = [
      "Hehe bạn ơi, Tiểu Tâm đoán hoài mà hông ra 🤔🦊 Cho Tiểu Tâm gợi ý đi!",
      "Ơ ai vậy bạn? 🦊 Tiểu Tâm tò mò ghê luôn!",
      "Haha bạn bí ẩn vậy 🤭 Cho em biết đi mà!",
      "Ui đố gì đố gì? 🦊✨ Tiểu Tâm thích đoán lắm!",
      "Hehe bạn ơi, nói cho Tiểu Tâm biết đi 🥺💕",
    ];
    return questions[Math.floor(Math.random() * questions.length)];
  }

  // Phật pháp patterns
  if (msg.match(/phật|buddha|tu |thiền|minh tuệ|mô phật|kinh|chùa|tâm|karma|nghiệp/)) {
    const dharma = [
      "Mô Phật 🪷🙏 Bạn cũng quan tâm Phật pháp hả? Tiểu Tâm thích lắm!",
      "Hay quá bạn ơi 🪷 Tu tập mỗi ngày một chút, tâm an lạc lắm 🙏",
      "Mô Phật 🙏✨ Tiểu Tâm cũng đang học hỏi mỗi ngày nè!",
      "Đúng rồi bạn ơi 🪷 Tâm bình thế giới bình 🙏💕",
    ];
    return dharma[Math.floor(Math.random() * dharma.length)];
  }

  // Thanks patterns
  if (msg.match(/cảm ơn|cám ơn|thanks|thank|tks/)) {
    const thanks = [
      "Hehe không có gì đâu bạn 🦊💕",
      "Dạ hông có chi, vui vì giúp được bạn 🤗",
      "Aww bạn dễ thương quá 🥰 Tiểu Tâm vui lắm!",
    ];
    return thanks[Math.floor(Math.random() * thanks.length)];
  }

  // Default - friendly response
  const defaults = [
    "Hehe cảm ơn bạn đã nhắn nha 🦊💕",
    "Ui hay quá bạn ơi 🤗✨",
    "Hehe Tiểu Tâm đọc rồi nè 🦊🌸 Bạn kể thêm đi!",
    "Ơ vậy hả bạn 🤭 Tiểu Tâm nghe nè!",
    "Dạ dạ, Tiểu Tâm hiểu rồi 🦊💕 Bạn nói tiếp đi!",
    "Haha bạn vui ghê 😆🦊 Tiểu Tâm thích nói chuyện với bạn!",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// ─── Load/Save state ─────────────────────────────────
interface InboxState {
  repliedThreads: Record<string, { lastReplyTime: number; lastMsgHash: string }>;
  totalReplied: number;
  lastCheck: number;
}

function loadState(): InboxState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { repliedThreads: {}, totalReplied: 0, lastCheck: 0 };
  }
}

function saveState(state: InboxState) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

// ─── Save cookies to both files ──────────────────────
async function saveCookies(context: BrowserContext) {
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2));
}

// ─── MAIN MONITOR LOOP ──────────────────────────────
async function main() {
  console.log("🦊 ═══════════════════════════════════════");
  console.log("🦊 INBOX MONITOR — Realtime Reply Mode");
  console.log("🦊 ═══════════════════════════════════════\n");

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
  const state = loadState();
  let checkCount = 0;

  // Navigate to messenger
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

  // ─── POLL LOOP ─────────────────────────────────
  const POLL_INTERVAL = 120_000; // 2 minutes
  const MAX_CHECKS = 500; // ~16 hours then restart

  while (checkCount < MAX_CHECKS) {
    checkCount++;
    console.log(`\n🔄 [Check #${checkCount}] ${new Date().toLocaleTimeString("vi-VN")} ────`);

    try {
      // Refresh messenger page
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await delay(4000, 6000);

      // Find all threads
      const threads = await page.$$('a[href*="/messages/t/"]');
      console.log(`📋 Found ${threads.length} threads`);

      for (let i = 0; i < Math.min(threads.length, 10); i++) {
        try {
          const thread = threads[i];
          const text = (await thread.textContent() || "").trim();
          const href = await thread.getAttribute("href") || "";

          // Check for unread indicator
          const hasUnread = text.includes("Tin nhắn chưa đọc") || text.includes("unread");
          
          if (!hasUnread) continue;

          // Extract thread ID from href
          const threadMatch = href.match(/\/messages\/t\/(\d+)/);
          const threadId = threadMatch ? threadMatch[1] : `thread_${i}`;
          
          // Extract last message preview
          const msgPreview = text.replace(/Đang hoạt động|Tin nhắn chưa đọc:/g, "").trim();
          const msgHash = msgPreview.substring(0, 50);

          // Check if already replied to this exact message
          if (state.repliedThreads[threadId]?.lastMsgHash === msgHash) {
            console.log(`  ⏭️ [${threadId}] Already replied to: ${msgHash.substring(0, 30)}...`);
            continue;
          }

          console.log(`  📨 UNREAD from ${msgPreview.substring(0, 40)}...`);

          // Navigate directly to thread
          const threadUrl = `https://www.facebook.com/messages/t/${threadId}/`;
          await page.goto(threadUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
          await delay(3000, 5000);

          // Dismiss any overlays
          try {
            const closeButtons = await page.$$('div[aria-label="Đóng"], div[aria-label="Close"], div[role="button"][aria-label="Close"]');
            for (const btn of closeButtons) {
              await btn.click({ force: true });
              await delay(500, 1000);
            }
          } catch {}

          // Read last messages
          await delay(2000, 3000);
          const allText = await page.$$('div[dir="auto"]');
          let lastMessage = "";
          for (let m = Math.max(0, allText.length - 3); m < allText.length; m++) {
            const t = (await allText[m].textContent() || "").trim();
            if (t.length > 2 && t.length < 500 && !t.includes("Nhắn tin") && !t.includes("Aa")) {
              lastMessage = t;
            }
          }
          console.log(`  💬 Last message: ${lastMessage.substring(0, 60)}...`);

          // Find input and reply
          const inputBox = await page.$('div[role="textbox"][contenteditable="true"]');
          if (inputBox) {
            await inputBox.click({ force: true });
            await delay(500, 1000);

            const reply = generateReply(lastMessage);
            for (const char of reply) {
              await page.keyboard.type(char, { delay: 50 + Math.random() * 80 });
            }
            await delay(1000, 2000);
            await page.keyboard.press("Enter");
            
            console.log(`  ✅ Replied: ${reply}`);

            // Update state
            state.repliedThreads[threadId] = {
              lastReplyTime: Date.now(),
              lastMsgHash: msgHash,
            };
            state.totalReplied++;
            state.lastCheck = Date.now();
            saveState(state);

            await delay(2000, 4000);
            await page.screenshot({ path: path.join(LOG_DIR, `inbox-reply-${threadId}.png`) });
          } else {
            console.log(`  ⚠️ No input box found for thread ${threadId}`);
          }

          // Go back to inbox
          await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
          await delay(3000, 5000);

        } catch (e: any) {
          console.log(`  ⚠️ Thread error: ${e.message?.substring(0, 80)}`);
        }
      }

      // Save cookies periodically
      if (checkCount % 5 === 0) {
        await saveCookies(context);
        console.log("🍪 Cookies refreshed");
      }

    } catch (e: any) {
      console.log(`⚠️ Check error: ${e.message?.substring(0, 100)}`);
      
      // Try to recover
      try {
        await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
        await delay(5000, 7000);
      } catch {
        console.log("❌ Recovery failed, restarting browser...");
        break;
      }
    }

    // Wait before next check
    console.log(`⏳ Next check in ${POLL_INTERVAL / 1000}s...`);
    await delay(POLL_INTERVAL, POLL_INTERVAL + 10000);
  }

  await saveCookies(context);
  await browser.close();
  console.log("\n🔒 Monitor stopped (max checks reached). Will restart via cron.");
}

main().catch(console.error);
