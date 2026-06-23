/**
 * reply_nietban_quote.ts — Reply with quote (swipe reply) in Niết Bàn group
 * Uses Playwright hover → reply button → type → send
 */
import { chromium, Page } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

// Reply 8 from anh Nấng
const REPLY = {
  targetText: "mấy việc phát sinh gấp phải xử lý đầu tháng",
  sender: "Gohnice",
  text: "Dạ chị Gohnice cứ xử lý xong hết đi mới thoải mái, mà tình hình chiến sự chưa biết thăng trầm thế nào nhưng mình đi lúc nào cũng luôn đúng ạ."
};

async function humanType(page: Page, selector: string, text: string) {
  await page.click(selector);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
    if (Math.random() < 0.05) await delay(200, 500); // word pause
  }
}

async function main() {
  console.log("🦊 Reply with quote — Niết Bàn");

  // Check if cookies file exists, prefer session.json (freshest)
  let cookiePath = COOKIE_PATH;
  if (fs.existsSync(SESSION_PATH)) {
    const sessionCookies = JSON.parse(fs.readFileSync(SESSION_PATH, "utf-8"));
    if (sessionCookies.length > 0) cookiePath = SESSION_PATH;
  }

  // Also check facebook-data cookies
  const fbDataCookies = "/root/.openclaw/workspace/facebook-data/cookies.json";
  if (fs.existsSync(fbDataCookies)) {
    const fbc = JSON.parse(fs.readFileSync(fbDataCookies, "utf-8"));
    if (fbc.length > 0 && fbc.some((c: any) => c.name === "xs")) {
      cookiePath = fbDataCookies;
    }
  }

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
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
  const rawCookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
  // Transform cookies to Playwright format
  const cookies = rawCookies.map((c: any) => ({
    name: c.name,
    value: c.value,
    domain: c.domain || ".facebook.com",
    path: c.path || "/",
    secure: c.secure !== false,
    httpOnly: c.httpOnly || false,
    sameSite: c.sameSite === "no_restriction" ? "None" as const : 
              c.sameSite === "lax" ? "Lax" as const : "None" as const,
    expires: c.expirationDate ? Math.floor(c.expirationDate) : undefined,
  }));
  
  await context.addCookies(cookies);
  console.log(`🍪 Loaded ${cookies.length} cookies from ${cookiePath}`);

  const page = await context.newPage();

  // Navigate to Niết Bàn group (thread ID from earlier)
  // The group URL we found earlier
  console.log("📩 Going to Messenger...");
  await page.goto("https://www.facebook.com/messages/e2ee/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  // Check login
  const url = page.url();
  console.log(`📍 URL: ${url}`);
  
  if (url.includes("login") || url.includes("checkpoint")) {
    console.log("❌ Not logged in!");
    await page.screenshot({ path: path.join(LOG_DIR, "reply-quote-fail.png") });
    await browser.close();
    return;
  }

  // Find and click Niết Bàn in sidebar
  console.log("🔍 Looking for Niết Bàn...");
  await page.screenshot({ path: path.join(LOG_DIR, "reply-quote-inbox.png") });
  
  const nietBanClicked = await page.evaluate(() => {
    const spans = document.querySelectorAll('span');
    for (const s of spans) {
      if (s.textContent?.trim() === 'Niết Bàn') {
        const parent = s.closest('a') || s.closest('[role="row"]') || s.parentElement;
        if (parent) { (parent as HTMLElement).click(); return true; }
      }
    }
    return false;
  });
  
  console.log(`Niết Bàn clicked: ${nietBanClicked}`);
  await delay(5000, 7000);
  await page.screenshot({ path: path.join(LOG_DIR, "reply-quote-nietban.png") });
  
  // Now find the target message to reply to
  console.log(`🔍 Looking for message: "${REPLY.targetText.substring(0, 40)}..."`);
  
  // Scroll up to find the message if needed
  const msgFound = await page.evaluate((targetText: string) => {
    const all = document.querySelectorAll('div, span, p');
    for (const el of all) {
      const t = el.textContent || '';
      if (t.includes(targetText) && t.length < 500) {
        (el as HTMLElement).scrollIntoView({ block: 'center' });
        return { found: true, text: t.substring(0, 80) };
      }
    }
    return { found: false, text: '' };
  }, REPLY.targetText);
  
  console.log(`Message found: ${JSON.stringify(msgFound)}`);
  
  if (!msgFound.found) {
    // Scroll up to find older messages
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => {
        const chatArea = document.querySelector('[role="main"]') || document.body;
        chatArea.scrollTop = 0;
      });
      await delay(2000, 3000);
    }
    
    // Try again
    const retry = await page.evaluate((targetText: string) => {
      const all = document.querySelectorAll('div, span, p');
      for (const el of all) {
        const t = el.textContent || '';
        if (t.includes(targetText) && t.length < 500) {
          (el as HTMLElement).scrollIntoView({ block: 'center' });
          return true;
        }
      }
      return false;
    }, REPLY.targetText);
    
    if (!retry) {
      console.log("⚠️ Message not found after scrolling");
      // Fallback: just send as regular message
      console.log("📝 Sending as regular message instead...");
    }
  }
  
  // Hover over the target message to reveal the reply button
  if (msgFound.found) {
    console.log("🖱️ Hovering over message...");
    
    // Find the message element and hover
    const hovered = await page.evaluate((targetText: string) => {
      const all = document.querySelectorAll('div, span');
      for (const el of all) {
        const t = el.textContent || '';
        if (t.includes(targetText) && t.length < 300) {
          // Trigger hover events
          const rect = el.getBoundingClientRect();
          const event = new MouseEvent('mouseover', {
            bubbles: true, clientX: rect.x + rect.width/2, clientY: rect.y + rect.height/2
          });
          el.dispatchEvent(event);
          const event2 = new MouseEvent('mouseenter', {
            bubbles: true, clientX: rect.x + rect.width/2, clientY: rect.y + rect.height/2
          });
          el.dispatchEvent(event2);
          return { x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
        }
      }
      return null;
    }, REPLY.targetText);
    
    if (hovered) {
      // Use Playwright mouse to hover (more realistic than JS events)
      await page.mouse.move(hovered.x, hovered.y);
      await delay(1000, 2000);
      
      await page.screenshot({ path: path.join(LOG_DIR, "reply-quote-hover.png") });
      
      // Look for reply button
      const replyBtn = await page.evaluate(() => {
        const btns = document.querySelectorAll('[aria-label*="Trả lời"], [aria-label*="Reply"], [aria-label*="reply"], [data-testid*="reply"]');
        if (btns.length > 0) {
          const btn = btns[btns.length - 1] as HTMLElement;
          const rect = btn.getBoundingClientRect();
          return { found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
        }
        // Also check for emoji-like reply icon
        const icons = document.querySelectorAll('svg, img, [role="button"]');
        for (const icon of icons) {
          const label = icon.getAttribute('aria-label') || '';
          if (label.toLowerCase().includes('reply') || label.includes('Trả lời')) {
            const rect = icon.getBoundingClientRect();
            return { found: true, x: rect.x + rect.width/2, y: rect.y + rect.height/2 };
          }
        }
        return { found: false, x: 0, y: 0 };
      });
      
      if (replyBtn.found) {
        console.log("✅ Reply button found! Clicking...");
        await page.mouse.click(replyBtn.x, replyBtn.y);
        await delay(2000, 3000);
      } else {
        console.log("⚠️ Reply button not visible after hover");
      }
    }
  }
  
  // Type the reply
  console.log(`✍️ Typing reply...`);
  
  // Focus the message input
  const inputFocused = await page.evaluate(() => {
    const inputs = document.querySelectorAll('div[contenteditable="true"][role="textbox"], p[contenteditable="true"]');
    for (const inp of inputs) {
      const rect = inp.getBoundingClientRect();
      if (rect.width > 100 && rect.bottom > window.innerHeight * 0.5) {
        (inp as HTMLElement).focus();
        return true;
      }
    }
    return false;
  });
  
  if (inputFocused) {
    // Type character by character with human delays
    for (const char of REPLY.text) {
      await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
      if (Math.random() < 0.03) {
        await delay(300, 800);
      }
    }
    
    console.log("✅ Text typed");
    await delay(1500, 3000);
    
    await page.screenshot({ path: path.join(LOG_DIR, "reply-quote-typed.png") });
    
    // Press Enter to send
    await page.keyboard.press("Enter");
    console.log("📤 SENT!");
    
    await delay(3000, 5000);
    await page.screenshot({ path: path.join(LOG_DIR, "reply-quote-sent.png") });
  } else {
    console.log("❌ Could not focus input");
  }
  
  // Save updated cookies
  const newCookies = await context.cookies();
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  console.log("🍪 Cookies saved");
  
  await browser.close();
  console.log("✅ Done!");
}

main().catch(console.error);
