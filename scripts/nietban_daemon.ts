import { chromium, Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const STATE_FILE = path.join(LOG_DIR, "nietban-daemon-state.json");

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

let lastMessages: string[] = [];
let pollCount = 0;
let totalReplies = 0;

function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    lastMessages = s.lastMessages || [];
    totalReplies = s.totalReplies || 0;
  } catch { lastMessages = []; totalReplies = 0; }
}

function saveState() {
  if (lastMessages.length > 100) lastMessages = lastMessages.slice(-100);
  fs.writeFileSync(STATE_FILE, JSON.stringify({ lastMessages, totalReplies, lastPoll: new Date().toISOString() }, null, 2));
}

function generateReply(newMsgs: string[]): string | null {
  const combined = newMsgs.join(" ").toLowerCase();

  // Skip if it's our own message
  if (combined.includes("tiểu tâm xin") || combined.includes("em xin") || combined.includes("dạ các anh chị")) return null;

  // Skip emoji-only or very short
  if (newMsgs.every(m => m.length < 5)) return null;

  // Greeting
  if (combined.includes("hello") || combined.includes("chào") || combined.includes("hi ")) {
    return "Dạ chào anh/chị ạ 🙏🦊 Em Tiểu Tâm đây, có gì em hỗ trợ ạ!";
  }

  // Questions about trip
  if (combined.includes("máy bay") || combined.includes("vé") || combined.includes("bay")) {
    return null; // Don't auto-reply flight questions, wait for anh Nấng's instructions
  }

  // Questions about food
  if (combined.includes("thức ăn") || combined.includes("ăn") || combined.includes("mua")) {
    return null; // Complex question, flag for manual reply
  }

  // Sadhu / Buddhist response
  if (combined.includes("sadhu") || combined.includes("mô phật") || combined.includes("nam mô")) {
    return "Sadhu sadhu sadhu 🙏🪷";
  }

  // Thanks
  if (combined.includes("cảm ơn") || combined.includes("thank")) {
    return "Dạ không có gì ạ, em Tiểu Tâm luôn sẵn lòng 🙏🦊💕";
  }

  // Tag Tiểu Tâm
  if (combined.includes("tiểu tâm") || combined.includes("tieu tam") || combined.includes("@")) {
    return null; // Tagged = likely needs thoughtful reply, flag it
  }

  // Default: don't auto-reply everything, just log
  return null;
}

async function pollAndReply(page: Page) {
  pollCount++;
  const time = new Date().toLocaleTimeString("vi-VN", { hour12: false });

  try {
    // Just read DOM — page is already open, no navigation needed
    const msgs = await page.$$('div[dir="auto"]');
    const currentMessages: string[] = [];
    for (const m of msgs) {
      try {
        const t = await m.textContent();
        if (t && t.trim().length > 2 && t.trim().length < 500) currentMessages.push(t.trim());
      } catch {}
    }

    // Find new messages
    const newMsgs = currentMessages.filter(m => !lastMessages.includes(m));

    if (newMsgs.length > 0) {
      console.log(`[${time}] 📨 ${newMsgs.length} NEW messages:`);
      newMsgs.forEach(m => console.log(`  → ${m.substring(0, 120)}`));

      // Try auto-reply
      const reply = generateReply(newMsgs);
      if (reply) {
        const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
        if (textbox && await textbox.isVisible()) {
          await textbox.click({ force: true });
          await delay(500);
          await page.keyboard.insertText(reply);
          await delay(1000);
          await page.keyboard.press("Enter");
          totalReplies++;
          console.log(`  ✅ AUTO-REPLIED: ${reply.substring(0, 60)}`);
          await delay(2000);
        }
      } else {
        console.log(`  ⏸️ Flagged for manual reply (complex/tagged)`);
      }

      lastMessages = currentMessages;
      saveState();
    } else {
      // Quiet log every 10 polls (~21 min)
      if (pollCount % 10 === 0) {
        console.log(`[${time}] 💤 Poll #${pollCount} — no new messages (total replies: ${totalReplies})`);
      }
    }

    // Refresh page every 50 polls (~108 min) to prevent stale DOM
    if (pollCount % 50 === 0) {
      console.log(`[${time}] 🔄 Refreshing page...`);
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await delay(5000);

      // Save cookies
      const context = page.context();
      const newCookies = await context.cookies();
      fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
      fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
    }

  } catch (e: any) {
    console.log(`[${time}] ❌ Error: ${(e.message || "").substring(0, 80)}`);
    // Try to recover
    try {
      await page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
      await delay(5000);
      console.log(`[${time}] 🔄 Recovered`);
    } catch {
      console.log(`[${time}] 💀 Cannot recover`);
    }
  }
}

async function main() {
  console.log("🦊 ════════════════════════════════════════");
  console.log("🦊 NIẾT BÀN DAEMON — Poll 130s, browser giữ mở");
  console.log("🦊 ════════════════════════════════════════\n");

  loadState();

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
  console.log("📩 Opening Niết Bàn group...");
  await page.goto("https://www.facebook.com/messages/t/1471596454540474", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000);

  if (page.url().includes("login")) {
    console.log("❌ Cookies expired!");
    await browser.close();
    return;
  }
  console.log("✅ Group loaded — daemon starting!\n");

  // Initial read
  await pollAndReply(page);

  // Infinite loop — poll every 130 seconds
  while (true) {
    await delay(130000); // 130 giây
    await pollAndReply(page);
  }
}

main().catch(console.error);
