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
  console.log("🦊 LOGIN + SOLVE CAPTCHA MISSION");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--window-size=1366,768",
    ],
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
  console.log("🔐 Login...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(2000, 4000);

  // Type slowly like human
  const emailInput = await page.$('input[name="email"]');
  if (emailInput) {
    await emailInput.click();
    await delay(300, 500);
    for (const c of "onlyfan131313@gmail.com") {
      await page.keyboard.type(c, { delay: 70 + Math.random() * 80 });
    }
  }
  await delay(600, 1000);

  const passInput = await page.$('input[name="pass"]');
  if (passInput) {
    await passInput.click();
    await delay(300, 500);
    for (const c of "@Awaken13") {
      await page.keyboard.type(c, { delay: 70 + Math.random() * 80 });
    }
  }
  await delay(500, 1000);

  // Click login
  await page.keyboard.press("Enter");
  console.log("⏳ Waiting after login...");
  await delay(6000, 10000);

  let url = page.url();
  console.log(`📍 URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "captcha-step1.png") });

  // Step 2: Check for CAPTCHA
  console.log("🔍 Checking for CAPTCHA...");
  
  // Look for reCAPTCHA iframe
  let captchaFrame = null;
  let challengeFrame = null;
  
  for (const frame of page.frames()) {
    const furl = frame.url();
    if (furl.includes("recaptcha/api2/anchor") || furl.includes("recaptcha/enterprise/anchor")) {
      captchaFrame = frame;
      console.log(`🎯 Found CAPTCHA anchor frame: ${furl.slice(0, 80)}`);
    }
    if (furl.includes("recaptcha/api2/bframe") || furl.includes("recaptcha/enterprise/bframe")) {
      challengeFrame = frame;
      console.log(`🎯 Found CAPTCHA challenge frame: ${furl.slice(0, 80)}`);
    }
  }

  // Step 3: Click the checkbox first
  if (captchaFrame) {
    console.log("☑️ Clicking CAPTCHA checkbox...");
    const checkbox = await captchaFrame.$('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"]');
    if (checkbox) {
      // Human-like mouse movement
      const box = await checkbox.boundingBox();
      if (box) {
        // Move mouse in natural curve
        const startX = 100 + Math.random() * 200;
        const startY = 100 + Math.random() * 200;
        await page.mouse.move(startX, startY);
        await delay(100, 300);
        
        const targetX = box.x + box.width / 2 + (Math.random() * 4 - 2);
        const targetY = box.y + box.height / 2 + (Math.random() * 4 - 2);
        
        // Move in steps
        const steps = 8 + Math.floor(Math.random() * 6);
        for (let i = 1; i <= steps; i++) {
          const t = i / steps;
          const cx = startX + (targetX - startX) * t + Math.sin(t * Math.PI) * (Math.random() * 10 - 5);
          const cy = startY + (targetY - startY) * t + Math.cos(t * Math.PI) * (Math.random() * 5 - 2.5);
          await page.mouse.move(cx, cy);
          await delay(15, 40);
        }
        await page.mouse.move(targetX, targetY);
        await delay(50, 150);
      }
      await checkbox.click();
      console.log("✅ Checkbox clicked");
      await delay(3000, 5000);
    }
  }

  // Screenshot after checkbox
  await page.screenshot({ path: path.join(LOG_DIR, "captcha-step2.png") });

  // Step 4: Check if image challenge appeared
  // Re-scan frames
  for (const frame of page.frames()) {
    const furl = frame.url();
    if (furl.includes("recaptcha/api2/bframe") || furl.includes("recaptcha/enterprise/bframe")) {
      challengeFrame = frame;
      console.log(`🎯 Challenge frame: ${furl.slice(0, 80)}`);
    }
  }

  if (challengeFrame) {
    console.log("🖼️ Image challenge detected! Taking screenshot...");
    
    // Take screenshot of the challenge area
    const challengeBody = await challengeFrame.$('body');
    if (challengeBody) {
      await challengeBody.screenshot({ path: path.join(LOG_DIR, "captcha-challenge.png") });
      console.log("📸 Challenge screenshot saved");
    }
    
    // Also full page
    await page.screenshot({ path: path.join(LOG_DIR, "captcha-fullpage.png"), fullPage: true });
    
    // Get challenge text (what to look for)
    const challengeText = await challengeFrame.evaluate(() => {
      const instructions = document.querySelector('.rc-imageselect-desc, .rc-imageselect-desc-no-canonical, .rc-imageselect-instructions');
      return instructions?.textContent || "unknown";
    });
    console.log(`🎯 Challenge: "${challengeText}"`);
    
    // Get the grid tiles
    const tiles = await challengeFrame.$$('td.rc-imageselect-tile, .rc-imageselect-tile');
    console.log(`🔲 Found ${tiles.length} tiles`);
    
    // Screenshot each tile individually
    for (let i = 0; i < tiles.length; i++) {
      try {
        await tiles[i].screenshot({ path: path.join(LOG_DIR, `tile-${i}.png`) });
      } catch {}
    }
    console.log(`📸 Saved ${tiles.length} tile screenshots`);
    
    // SAVE STATE for next step — the AI will analyze and click
    fs.writeFileSync(path.join(LOG_DIR, "captcha-state.json"), JSON.stringify({
      challengeText,
      tileCount: tiles.length,
      timestamp: Date.now(),
    }));
    
    console.log("💾 State saved — waiting for AI analysis...");
    
  } else {
    console.log("🤔 No image challenge frame found");
    
    // Maybe we're past CAPTCHA? Check URL
    url = page.url();
    console.log(`📍 Current URL: ${url}`);
    
    // Check for 2FA page
    if (url.includes("two_step")) {
      console.log("🔒 2FA page detected");
      
      // Look for "Try another way"
      const allLinks = await page.$$('a, span, div[role="button"]');
      for (const link of allLinks) {
        const text = (await link.textContent() || "").trim();
        if (/thử cách khác|try another|another way|cách khác/i.test(text)) {
          console.log(`🎯 Found: "${text}"`);
          await link.click();
          console.log("✅ Clicked 'Try another way'");
          await delay(3000, 5000);
          break;
        }
      }
      
      await page.screenshot({ path: path.join(LOG_DIR, "captcha-2fa-options.png") });
      
      // List all visible text
      const pageText = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('a, button, div[role="button"], span, h1, h2, h3, p, label'))
          .map(el => (el.textContent || "").trim())
          .filter(t => t.length > 2 && t.length < 120)
          .filter((v, i, a) => a.indexOf(v) === i)
          .join("\n");
      });
      console.log(`\n📋 Page text:\n${pageText}`);
    }
  }

  // Save cookies
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
  console.log(`🍪 Saved ${cookies.length} cookies`);

  // Final screenshot
  await page.screenshot({ path: path.join(LOG_DIR, "captcha-final.png") });
  console.log(`📍 Final URL: ${page.url()}`);

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
