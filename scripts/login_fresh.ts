import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  console.log("🦊 FRESH LOGIN — 2FA đã tắt, vào thẳng!");
  
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
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

  const page = await context.newPage();

  // Step 1: Go to login
  console.log("🔐 Navigating to login...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(2000, 3000);
  await page.screenshot({ path: path.join(LOG_DIR, "fresh-1-login-page.png") });

  // Step 2: Type email (human-like, char by char)
  console.log("✍️ Typing email...");
  const emailInput = await page.$('input[name="email"], #email');
  if (emailInput) {
    await emailInput.click();
    await delay(300, 500);
    const fbEmail = process.env.FB_EMAIL || "onlyfan131313@gmail.com";
    await page.type('input[name="email"]', fbEmail, { delay: 70 + Math.random() * 60 });
  }
  await delay(500, 1000);

  // Step 3: Type password
  console.log("✍️ Typing password...");
  const passInput = await page.$('input[name="pass"], #pass');
  if (passInput) {
    await passInput.click();
    await delay(300, 500);
    const fbPass = process.env.FB_PASS || "@Awaken13";
    await page.type('input[name="pass"]', fbPass, { delay: 70 + Math.random() * 60 });
  }
  await delay(500, 1000);

  // Step 4: Click login
  console.log("🖱️ Clicking login...");
  const loginSelectors = [
    'button[name="login"]',
    'button[type="submit"]',
    'button[data-testid="royal_login_button"]',
    'div[role="button"]:has-text("Đăng nhập")',
    'div[role="button"]:has-text("Log in")',
  ];
  
  let clicked = false;
  for (const sel of loginSelectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout: 3000, state: "visible" });
      if (el) { await el.click(); clicked = true; console.log(`✅ Clicked: ${sel}`); break; }
    } catch {}
  }
  if (!clicked) {
    await page.keyboard.press("Enter");
    console.log("⌨️ Pressed Enter");
  }

  // Step 5: Wait for result
  console.log("⏳ Waiting...");
  await delay(8000, 12000);
  
  let url = page.url();
  console.log(`📍 URL after login: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "fresh-2-after-login.png") });

  // Step 6: Handle CAPTCHA if present
  let captchaSolved = false;
  for (const frame of page.frames()) {
    const furl = frame.url();
    if (furl.includes("recaptcha") || furl.includes("captcha")) {
      console.log(`🎯 CAPTCHA detected: ${furl}`);
      try {
        const cb = await frame.$('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"]');
        if (cb) {
          const box = await cb.boundingBox();
          if (box) {
            // Human-like mouse movement to checkbox
            await page.mouse.move(box.x + box.width/2 + (Math.random()*4-2), box.y + box.height/2 + (Math.random()*4-2), { steps: 20 });
            await delay(200, 400);
          }
          await cb.click();
          console.log("✅ Clicked CAPTCHA checkbox");
          captchaSolved = true;
          await delay(5000, 8000);
        }
      } catch (e) {
        console.log(`⚠️ CAPTCHA click error: ${e}`);
      }
    }
  }

  if (captchaSolved) {
    // Wait for CAPTCHA to process and page to redirect
    await delay(5000, 8000);
    url = page.url();
    console.log(`📍 URL after CAPTCHA: ${url}`);
    await page.screenshot({ path: path.join(LOG_DIR, "fresh-3-after-captcha.png") });
  }

  // Step 7: Handle "Save browser" / "Trust this device" prompts
  const trustSelectors = [
    'div[role="button"]:has-text("Tiếp tục")',
    'div[role="button"]:has-text("Continue")',
    'div[role="button"]:has-text("OK")',
    'div[role="button"]:has-text("Save")',
    'div[role="button"]:has-text("Lưu")',
    'div[role="button"]:has-text("Trust")',
    'a:has-text("Tiếp tục")',
    'a:has-text("Continue")',
    'button:has-text("Tiếp tục")',
    'button:has-text("Continue")',
  ];
  
  for (const sel of trustSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        await el.click();
        console.log(`🖱️ Clicked trust/continue: ${sel}`);
        await delay(3000, 5000);
      }
    } catch {}
  }

  url = page.url();
  console.log(`📍 Final URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "fresh-4-final.png") });

  // Step 8: Check if we're actually logged in
  const isLoggedIn = !url.includes("login") && !url.includes("checkpoint") && !url.includes("two_step");
  
  if (isLoggedIn) {
    console.log("✅✅✅ LOGIN THÀNH CÔNG! 🦊🔥");
    
    // Go to profile
    await page.goto("https://www.facebook.com/me", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(4000, 6000);
    console.log(`📍 Profile URL: ${page.url()}`);
    await page.screenshot({ path: path.join(LOG_DIR, "fresh-5-profile.png") });
    
    // Get profile name
    const title = await page.title();
    console.log(`📄 Title: ${title}`);
    
    // Scroll profile
    await page.evaluate(() => window.scrollBy(0, 500));
    await delay(2000, 3000);
    await page.screenshot({ path: path.join(LOG_DIR, "fresh-6-profile-scroll.png") });
    
    // Save cookies — PERMANENT
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log(`🍪 SAVED ${cookies.length} cookies permanently!`);
    
  } else {
    console.log(`❌ Vẫn chưa vào được. URL: ${url}`);
    
    // Dump page content for debug
    const text = await page.textContent('body');
    console.log(`📄 Page text (first 500): ${(text||"").substring(0, 500)}`);
  }

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
