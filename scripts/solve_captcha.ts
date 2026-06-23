/**
 * solve_captcha.ts — Click "I'm not a robot" checkbox on Facebook login
 */
import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CONFIG_PATH = path.join(__dirname, "..", "config", "default.json");
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

async function main() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  const bc = config.browser;

  console.log("🚀 Launching browser...");
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: bc.viewport.width, height: bc.viewport.height },
    userAgent: bc.userAgent,
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
  });

  // Load cookies if exists
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
    if (cookies.length) {
      await context.addCookies(cookies);
      console.log(`🍪 Loaded ${cookies.length} cookies`);
    }
  }

  const page = await context.newPage();

  // Human-like: random mouse movements, delays
  const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

  console.log("🌐 Navigating to Facebook login...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(2000, 4000);

  let url = page.url();
  console.log(`📍 Current URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "captcha-step1.png") });

  // Check if we need to login first
  const emailInput = await page.$('input[name="email"]');
  if (emailInput) {
    console.log("📝 Login page detected, entering credentials...");
    
    // Type email with human-like delays
    await emailInput.click();
    await delay(300, 600);
    await page.fill('input[name="email"]', "");
    await page.type('input[name="email"]', "onlyfan131313@gmail.com", { delay: 80 + Math.random() * 120 });
    await delay(500, 1000);
    
    // Type password
    const passInput = await page.$('input[name="pass"]');
    if (passInput) {
      await passInput.click();
      await delay(300, 600);
      await page.type('input[name="pass"]', "@Awaken13", { delay: 80 + Math.random() * 120 });
      await delay(500, 1000);
    }
    
    // Click login button
    const loginBtn = await page.$('button[name="login"], button[type="submit"], button[data-testid="royal_login_button"]');
    if (loginBtn) {
      await loginBtn.click();
      console.log("🖱️ Clicked login button");
    } else {
      await page.keyboard.press("Enter");
      console.log("⌨️ Pressed Enter");
    }
    
    await delay(5000, 8000);
    url = page.url();
    console.log(`📍 After login URL: ${url}`);
    await page.screenshot({ path: path.join(LOG_DIR, "captcha-step2-after-login.png") });
  }

  // Now look for CAPTCHA / "I'm not a robot" checkbox
  console.log("🔍 Looking for CAPTCHA...");
  
  // Method 1: Look for reCAPTCHA iframe
  const frames = page.frames();
  console.log(`Found ${frames.length} frames`);
  
  for (const frame of frames) {
    const frameUrl = frame.url();
    if (frameUrl.includes("recaptcha") || frameUrl.includes("captcha") || frameUrl.includes("hcaptcha")) {
      console.log(`🎯 Found captcha frame: ${frameUrl}`);
      
      // Click the checkbox
      try {
        const checkbox = await frame.$('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"], .cb-i');
        if (checkbox) {
          // Move mouse naturally before clicking
          const box = await checkbox.boundingBox();
          if (box) {
            await page.mouse.move(box.x + box.width/2 + (Math.random()*6-3), box.y + box.height/2 + (Math.random()*6-3), { steps: 15 + Math.floor(Math.random()*10) });
            await delay(200, 500);
          }
          await checkbox.click();
          console.log("✅ Clicked reCAPTCHA checkbox!");
          await delay(3000, 5000);
          await page.screenshot({ path: path.join(LOG_DIR, "captcha-step3-clicked.png") });
        }
      } catch (e) {
        console.log(`⚠️ Error clicking in frame: ${e}`);
      }
    }
  }

  // Method 2: Look for checkbox directly on page  
  const captchaSelectors = [
    'iframe[src*="recaptcha"]',
    'iframe[src*="captcha"]',
    'iframe[src*="hcaptcha"]',
    'iframe[title*="reCAPTCHA"]',
    'iframe[title*="captcha"]',
    '.captcha_interstitial',
    '#captcha',
    '[data-testid="captcha"]',
    'div[class*="captcha"]',
  ];
  
  for (const sel of captchaSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        console.log(`🎯 Found captcha element: ${sel}`);
        
        if (sel.startsWith('iframe')) {
          const frame = await el.contentFrame();
          if (frame) {
            // Try clicking checkbox inside iframe
            const cb = await frame.$('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"], .cb-i, #checkbox');
            if (cb) {
              await cb.click();
              console.log("✅ Clicked checkbox in iframe!");
              await delay(3000, 5000);
            } else {
              console.log("No checkbox found in iframe, trying general click...");
              // Try clicking center of iframe
              const box = await el.boundingBox();
              if (box) {
                await page.mouse.click(box.x + 28, box.y + 28);
                console.log("✅ Clicked center-left of captcha iframe (checkbox position)");
                await delay(3000, 5000);
              }
            }
          }
        } else {
          await el.click();
          console.log("✅ Clicked captcha element!");
          await delay(3000, 5000);
        }
        
        await page.screenshot({ path: path.join(LOG_DIR, "captcha-step3-clicked.png") });
        break;
      }
    } catch (e) {
      console.log(`Selector ${sel} error: ${e}`);
    }
  }

  // Method 3: Try text-based search
  const textSelectors = [
    'text="Tôi không phải người máy"',
    'text="I\'m not a robot"',
    'text="Xác nhận"',
    'text="Verify"',
    'text="Tiếp tục"',
    'text="Continue"',
  ];
  
  for (const sel of textSelectors) {
    try {
      const el = await page.$(sel);
      if (el) {
        console.log(`🎯 Found text element: ${sel}`);
        await el.click();
        console.log("✅ Clicked!");
        await delay(3000, 5000);
        await page.screenshot({ path: path.join(LOG_DIR, "captcha-step3-text-clicked.png") });
        break;
      }
    } catch {}
  }

  // Check final state
  await delay(3000, 5000);
  url = page.url();
  console.log(`📍 Final URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "captcha-final.png") });
  
  // Get page content for debugging
  const bodyText = await page.textContent('body');
  const snippet = (bodyText || "").substring(0, 500);
  console.log(`📄 Page text: ${snippet}`);

  // If logged in, save cookies
  if (url.includes("facebook.com") && !url.includes("login") && !url.includes("checkpoint")) {
    console.log("✅✅✅ LOGIN THÀNH CÔNG! 🦊");
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log(`🍪 Saved ${cookies.length} cookies`);
  } else {
    console.log("⏳ Chưa xong — check screenshots");
  }

  await browser.close();
  console.log("🔒 Browser closed");
}

main().catch(console.error);
