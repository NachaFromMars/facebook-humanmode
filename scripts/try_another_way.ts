import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("🦊 Login + Click 'Thử cách khác'...");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  // Step 1: Login
  console.log("🔐 Going to login...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(2000, 3000);

  await page.type('input[name="email"]', "onlyfan131313@gmail.com", { delay: 80 + Math.random() * 60 });
  await delay(500, 800);
  await page.type('input[name="pass"]', "@Awaken13", { delay: 80 + Math.random() * 60 });
  await delay(500, 1000);
  
  // Click login
  const loginSelectors = [
    'button[name="login"]',
    'button[type="submit"]',
    'div[role="button"]:has-text("Đăng nhập")',
    'div[role="button"]:has-text("Log in")',
  ];
  for (const sel of loginSelectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 2000, state: "visible" });
      if (el) { await el.click(); console.log(`🖱️ Login clicked: ${sel}`); break; }
    } catch {}
  }

  console.log("⏳ Waiting for response...");
  await delay(6000, 10000);

  let url = page.url();
  console.log(`📍 URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "try-step1.png") });

  // Handle CAPTCHA if present
  for (const frame of page.frames()) {
    if (frame.url().includes("recaptcha")) {
      console.log("🤖 CAPTCHA detected, clicking...");
      const cb = await frame.$('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"]');
      if (cb) {
        const box = await cb.boundingBox();
        if (box) {
          await page.mouse.move(box.x + box.width/2 + (Math.random()*4-2), box.y + box.height/2 + (Math.random()*4-2), { steps: 12 });
          await delay(200, 400);
        }
        await cb.click();
        console.log("✅ CAPTCHA clicked");
        await delay(5000, 8000);
      }
    }
  }

  url = page.url();
  console.log(`📍 After CAPTCHA URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "try-step2.png") });

  // Step 2: Click "Thử cách khác" / "Try another way"
  console.log("🔍 Looking for 'Thử cách khác' / 'Try another way'...");
  
  const tryAnotherSelectors = [
    'a:has-text("Thử cách khác")',
    'a:has-text("Try another way")',
    'span:has-text("Thử cách khác")',
    'span:has-text("Try another way")',
    'div[role="button"]:has-text("Thử cách khác")',
    'div[role="button"]:has-text("Try another way")',
    'a:has-text("thử cách khác")',
    'a:has-text("try another way")',
    // Also try partial matches
    'a:has-text("cách khác")',
    'a:has-text("another way")',
    'a:has-text("other method")',
    'a:has-text("Need another way")',
    'a:has-text("Cần cách khác")',
  ];

  let clicked = false;
  for (const sel of tryAnotherSelectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000, state: "visible" });
      if (el) {
        console.log(`🎯 Found: ${sel}`);
        await el.click();
        clicked = true;
        console.log("✅ Clicked 'Thử cách khác'!");
        break;
      }
    } catch {}
  }

  if (!clicked) {
    // Try finding ALL links and buttons on page
    console.log("⚠️ Specific selectors failed, scanning all links...");
    const allLinks = await page.$$('a, div[role="button"], span[role="button"]');
    for (const link of allLinks) {
      const text = await link.textContent() || "";
      console.log(`  Link: "${text.trim().slice(0, 60)}"`);
      if (/thử cách khác|try another|cách khác|another way|need another|khác|other/i.test(text)) {
        await link.click();
        clicked = true;
        console.log(`✅ Clicked link: "${text.trim().slice(0, 60)}"`);
        break;
      }
    }
  }

  await delay(3000, 5000);
  url = page.url();
  console.log(`📍 After click URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "try-step3-after-click.png") });

  // Step 3: See what options are available
  console.log("\n📋 Scanning page for options...");
  const allText = await page.evaluate(() => {
    const links = document.querySelectorAll('a, button, div[role="button"], span');
    const texts: string[] = [];
    links.forEach(el => {
      const t = (el.textContent || "").trim();
      if (t.length > 2 && t.length < 100) texts.push(t);
    });
    return [...new Set(texts)].join(" | ");
  });
  console.log(`Page options: ${allText.slice(0, 1000)}`);

  // Try clicking any "Continue" / "Send code" / "SMS" options
  const nextStepSelectors = [
    'div[role="button"]:has-text("Gửi mã")',
    'div[role="button"]:has-text("Send code")',
    'div[role="button"]:has-text("SMS")',
    'div[role="button"]:has-text("Text message")',
    'div[role="button"]:has-text("Tin nhắn")',
    'div[role="button"]:has-text("Tiếp tục")',
    'div[role="button"]:has-text("Continue")',
    'a:has-text("Approve from another device")',
    'a:has-text("Phê duyệt từ thiết bị khác")',
  ];

  for (const sel of nextStepSelectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 2000, state: "visible" });
      if (el) {
        console.log(`🎯 Found next step: ${sel}`);
        await el.click();
        console.log("✅ Clicked!");
        await delay(3000, 5000);
        await page.screenshot({ path: path.join(LOG_DIR, "try-step4-next.png") });
        break;
      }
    } catch {}
  }

  // Final state
  url = page.url();
  console.log(`\n📍 FINAL URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "try-final.png") });

  // If logged in, save cookies
  if (url.includes("facebook.com") && !url.includes("login") && !url.includes("checkpoint") && !url.includes("two_step")) {
    console.log("✅✅✅ LOGIN THÀNH CÔNG! 🦊");
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log(`🍪 Saved ${cookies.length} cookies`);
  } else {
    console.log("⏳ Chưa xong — kiểm tra screenshots");
    // Save what we have
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  }

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
