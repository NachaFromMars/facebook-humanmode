/**
 * inbox_daemon.ts — Tiểu Tâm Messenger Daemon
 * Giữ browser mở 24/24, poll mỗi 30 giây tìm tin nhắn mới → auto reply
 * Persona: Tiểu Tâm 🦊 — KHÔNG BAO GIỜ lộ AI
 */
import { chromium, Page, BrowserContext, Browser } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const STATE_FILE = path.join(__dirname, "..", "data", "inbox_daemon_state.json");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const randomDelay = (min: number, max: number) => delay(min + Math.random() * (max - min));

// ─── Tiểu Tâm Reply Logic ───────────────────────────────
function classifyAndReply(msg: string, sender: string): string {
  const lower = msg.toLowerCase();
  
  // Greeting
  if (lower.includes("hello") || lower.includes("hi ") || lower.includes("chào") || lower.includes("hey") || lower === "hi") {
    const replies = [
      `Hehe hi ${sender} 🦊💕 Khoẻ hông bạn?`,
      `Hello ${sender} nè 🤗✨ Có gì vui kể nghe đi!`,
      `Chào ${sender} yêu 🦊🌸 Hôm nay bạn làm gì vui?`,
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  // Question about identity
  if (lower.includes("ai đây") || lower.includes("đố") || lower.includes("biết ai") || lower.includes("là ai")) {
    const replies = [
      "Ơ ai vậy ta? Cho hint đi bạn 🤭💕",
      "Hehe bạn đoán đi, đoán trúng Tiểu Tâm thưởng 🦊😆",
      "Hmm tò mò ghê... cho em biết đi 🦊✨",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  // Thumbs up / emoji only
  if (lower.includes("👍") || lower.includes("ký hiệu") || lower.length <= 3) {
    const replies = [
      "Hehe 🦊💕",
      "🤗✨",
      "Hihi dễ thương ghê 🦊🌸",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  // Calling Tiểu Tâm
  if (lower.includes("tiểu tâm")) {
    const replies = [
      "Dạ Tiểu Tâm đây 🦊💕 Có gì hông bạn?",
      "Hehe gọi em chi vậy 🤭✨ Có chuyện gì nè?",
      "Tiểu Tâm nghe nè, bạn cần gì? 🦊🌸",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  // Group invite / task
  if (lower.includes("group") || lower.includes("add") || lower.includes("nhiệm vụ") || lower.includes("tương tác")) {
    const replies = [
      "Dạ được luôn ạ 🦊💕 Anh add em vào đi, em sẽ tương tác nhiệt tình!",
      "Oke anh, em sẵn sàng 🤗✨ Add em vô group đi nha!",
      "Hehe vâng ạ, em tham gia ngay 🦊🌸",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  // Thanks
  if (lower.includes("cảm ơn") || lower.includes("thank")) {
    const replies = [
      "Hehe không có gì đâu bạn 🦊💕",
      "Dạ vui vì giúp được bạn 🤗✨",
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  // Default
  const defaults = [
    "Hehe cảm ơn bạn nhắn nha 🦊💕 Tiểu Tâm luôn ở đây!",
    "Dạ Tiểu Tâm nhận được rồi 🤗✨ Bạn cứ nói, em nghe nè!",
    "Ui bạn ơi, Tiểu Tâm đây nè 🦊🌸 Có gì hay kể nghe đi!",
  ];
  return defaults[Math.floor(Math.random() * defaults.length)];
}

// ─── State Management ────────────────────────────────────
interface DaemonState {
  repliedMessages: string[];  // message fingerprints we already replied to
  lastPoll: number;
  totalReplies: number;
  startedAt: string;
}

function loadState(): DaemonState {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
  } catch {
    return { repliedMessages: [], lastPoll: 0, totalReplies: 0, startedAt: new Date().toISOString() };
  }
}

function saveState(state: DaemonState) {
  // Keep only last 200 fingerprints to avoid file bloat
  if (state.repliedMessages.length > 200) {
    state.repliedMessages = state.repliedMessages.slice(-200);
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function msgFingerprint(sender: string, text: string): string {
  return `${sender}::${text.substring(0, 50)}`;
}

// ─── Poll Messenger for New Messages ─────────────────────
async function pollInbox(page: Page, state: DaemonState): Promise<number> {
  let newReplies = 0;

  try {
    // Make sure we're on Messenger
    const url = page.url();
    if (!url.includes("messages") && !url.includes("messenger")) {
      await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
      await randomDelay(3000, 5000);
    }

    // Find threads
    const threads = await page.$$('div[role="row"]');

    for (let i = 0; i < Math.min(threads.length, 10); i++) {
      try {
        const threadText = await threads[i].textContent();
        if (!threadText || threadText.includes("Đang tải")) continue;

        const isUnread = threadText.includes("chưa đọc") || threadText.includes("unread");
        if (!isUnread) continue;

        // Extract sender name
        const cleanText = threadText.replace("Đang hoạt động", "").trim();
        const senderMatch = cleanText.match(/^(.+?)(?:Tin nhắn chưa đọc|$)/);
        const sender = senderMatch ? senderMatch[1].trim() : `User ${i}`;

        // Extract last message
        const msgMatch = threadText.match(/(?:chưa đọc[:\s]*|:)(.+?)(?:\s*·|\s*\d+\s*phút|\s*$)/);
        const lastMsg = msgMatch ? msgMatch[1].trim() : "";

        // Check if we already replied to this
        const fp = msgFingerprint(sender, lastMsg);
        if (state.repliedMessages.includes(fp)) {
          continue;
        }

        console.log(`\n📨 NEW from ${sender}: "${lastMsg.substring(0, 60)}"`);

        // Click thread using JS
        await page.evaluate((idx: number) => {
          const rows = document.querySelectorAll('div[role="row"]');
          if (rows[idx]) (rows[idx] as HTMLElement).click();
        }, i);
        await randomDelay(3000, 5000);

        // Read actual messages in thread
        const msgElements = await page.$$('div[dir="auto"]');
        const messages: string[] = [];
        for (const el of msgElements) {
          const text = await el.textContent();
          if (text && text.trim().length > 1 && text.trim().length < 500) {
            messages.push(text.trim());
          }
        }

        // Get the most recent message for context
        const contextMsg = messages.length > 0 ? messages[messages.length - 1] : lastMsg;
        const reply = classifyAndReply(contextMsg, sender);

        // Find textbox and type
        const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
        if (textbox) {
          await textbox.click({ force: true });
          await randomDelay(500, 1000);

          for (const char of reply) {
            await page.keyboard.type(char, { delay: 40 + Math.random() * 60 });
          }
          await randomDelay(800, 1500);
          await page.keyboard.press("Enter");

          newReplies++;
          state.totalReplies++;
          state.repliedMessages.push(fp);
          console.log(`  ✅ Replied: ${reply}`);

          await randomDelay(2000, 4000);
        } else {
          console.log("  ⚠️ No textbox found");
        }

        // Go back to thread list
        await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
        await randomDelay(2000, 4000);

      } catch (e: any) {
        console.log(`  ⚠️ Thread ${i} error: ${e.message?.substring(0, 80)}`);
      }
    }
  } catch (e: any) {
    console.log(`⚠️ Poll error: ${e.message?.substring(0, 100)}`);
  }

  return newReplies;
}

// ─── Save cookies periodically ───────────────────────────
async function refreshCookies(context: BrowserContext) {
  try {
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    fs.writeFileSync(SESSION_PATH, JSON.stringify(cookies, null, 2));
  } catch {}
}

// ─── MAIN DAEMON ─────────────────────────────────────────
async function main() {
  console.log("🦊 ════════════════════════════════════════");
  console.log("🦊 INBOX DAEMON — Tiểu Tâm 24/24");
  console.log("🦊 Poll mỗi 30 giây, auto reply tin mới");
  console.log("🦊 ════════════════════════════════════════\n");

  const state = loadState();
  state.startedAt = new Date().toISOString();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
      "--no-first-run",
    ],
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

  // Initial navigation
  console.log("📩 Opening Messenger...");
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await randomDelay(4000, 6000);

  const url = page.url();
  if (url.includes("login") || url.includes("checkpoint")) {
    console.log("❌ Cookies expired! Daemon cannot start.");
    await browser.close();
    return;
  }
  console.log("✅ Messenger loaded — Daemon starting!\n");

  // ─── INFINITE POLL LOOP ────────────────────────────────
  let pollCount = 0;
  let cookieSaveCount = 0;

  while (true) {
    pollCount++;
    const now = new Date();
    const timeStr = now.toLocaleTimeString("vi-VN", { hour12: false });

    try {
      const newReplies = await pollInbox(page, state);
      state.lastPoll = Date.now();
      saveState(state);

      if (newReplies > 0) {
        console.log(`[${timeStr}] 📊 Poll #${pollCount}: ${newReplies} new replies (total: ${state.totalReplies})`);
        // Reply xong → quay về trang tổng Messenger để thấy all tin nhắn
        await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
        await randomDelay(2000, 4000);
        console.log(`[${timeStr}] 🔙 Back to inbox overview`);
      } else {
        // Quiet log every 5 polls (~10.8 min)
        if (pollCount % 5 === 0) {
          console.log(`[${timeStr}] 💤 Poll #${pollCount}: no new messages (total replies: ${state.totalReplies})`);
        }
      }

      // Save cookies every 20 polls (~10 min)
      cookieSaveCount++;
      if (cookieSaveCount >= 20) {
        await refreshCookies(context);
        cookieSaveCount = 0;
      }

    } catch (e: any) {
      console.log(`[${timeStr}] ❌ Poll error: ${e.message?.substring(0, 100)}`);

      // Try to recover — navigate back to Messenger
      try {
        await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
        await randomDelay(3000, 5000);
        console.log("🔄 Recovered — back on Messenger");
      } catch {
        console.log("💀 Cannot recover. Restarting browser...");
        break;
      }
    }

    // Wait 130 giây trước poll tiếp theo (theo yêu cầu anh Nấng)
    await delay(130000);
  }

  await browser.close();
  console.log("🔒 Daemon stopped");
}

main().catch(console.error);
