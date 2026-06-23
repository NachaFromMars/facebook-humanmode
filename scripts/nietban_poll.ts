import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const STATE_FILE = path.join(LOG_DIR, "nietban-poll-state.json");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

function loadState(): { lastMessages: string[] } {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, "utf-8")); } catch { return { lastMessages: [] }; }
}
function saveState(state: { lastMessages: string[] }) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function pollOnce(): Promise<{ newMessages: string[], allMessages: string[] }> {
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
  await delay(4000, 6000);

  const msgs = await page.$$('div[dir="auto"]');
  const allMessages: string[] = [];
  for (const m of msgs) {
    try {
      const t = await m.textContent();
      if (t && t.trim().length > 2 && t.trim().length < 500) allMessages.push(t.trim());
    } catch {}
  }

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();

  const state = loadState();
  const newMessages = allMessages.filter(m => !state.lastMessages.includes(m));
  state.lastMessages = allMessages;
  saveState(state);

  return { newMessages, allMessages };
}

async function sendReply(text: string) {
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
  await delay(4000, 6000);

  const textbox = await page.$('div[role="textbox"][contenteditable="true"]');
  if (textbox && await textbox.isVisible()) {
    await textbox.click({ force: true });
    await delay(500, 1000);
    await page.keyboard.insertText(text);
    await delay(1000, 2000);
    await page.keyboard.press("Enter");
    console.log("SENT: " + text.substring(0, 80) + "...");
    await delay(2000, 4000);
  }

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
}

// Export for external use
export { pollOnce, sendReply };

// If run directly — just poll once and output new messages as JSON
if (process.argv[1]?.includes("nietban_poll")) {
  pollOnce().then(({ newMessages, allMessages }) => {
    console.log(JSON.stringify({ newMessages, allMessages, timestamp: new Date().toISOString() }));
  }).catch(console.error);
}
