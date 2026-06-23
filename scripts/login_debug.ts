import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
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
  console.log("STEP 1: Vào login page...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(2000, 3000);
  await page.screenshot({ path: path.join(LOG_DIR, "debug-1-login-page.png") });
  console.log("📸 Screenshot 1: Login page");

  // Step 2: Enter email
  console.log("STEP 2: Nhập email...");
  await page.type('input[name="email"]', "onlyfan131313@gmail.com", { delay: 90 });
  await delay(500, 800);
  await page.type('input[name="pass"]', "@Awaken13", { delay: 90 });
  await delay(500, 800);
  await page.screenshot({ path: path.join(LOG_DIR, "debug-2-credentials.png") });
  console.log("📸 Screenshot 2: Credentials filled");

  // Step 3: Click login
  console.log("STEP 3: Click login...");
  const loginBtn = await page.$('button[name="login"], button[type="submit"]');
  if (loginBtn) {
    await loginBtn.click();
  } else {
    // Try role-based selectors
    for (const sel of ['div[role="button"]:has-text("Đăng nhập")', 'div[role="button"]:has-text("Log in")']) {
      try {
        const el = await page.waitForSelector(sel, { timeout: 2000 });
        if (el) { await el.click(); break; }
      } catch {}
    }
  }
  
  console.log("⏳ Đợi response...");
  await delay(8000, 10000);
  
  const afterLoginUrl = page.url();
  console.log(`📍 URL sau login: ${afterLoginUrl}`);
  await page.screenshot({ path: path.join(LOG_DIR, "debug-3-after-login.png") });
  console.log("📸 Screenshot 3: Sau khi click login");

  // Step 4: Check what's on page
  const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 1000) || "");
  console.log(`📄 Nội dung trang: ${pageText.slice(0, 300)}`);

  // Step 5: Handle CAPTCHA if present
  let captchaFound = false;
  for (const frame of page.frames()) {
    if (frame.url().includes("recaptcha") || frame.url().includes("captcha")) {
      console.log("🤖 CAPTCHA detected! Clicking...");
      captchaFound = true;
      try {
        const cb = await frame.$('#recaptcha-anchor, .recaptcha-checkbox, [role="checkbox"]');
        if (cb) {
          await cb.click();
          console.log("✅ Clicked CAPTCHA checkbox");
          await delay(5000, 8000);
        }
      } catch (e) {
        console.log(`CAPTCHA click error: ${e}`);
      }
    }
  }

  if (captchaFound) {
    await page.screenshot({ path: path.join(LOG_DIR, "debug-4-after-captcha.png") });
    console.log("📸 Screenshot 4: Sau CAPTCHA");
    
    const afterCaptchaUrl = page.url();
    console.log(`📍 URL sau CAPTCHA: ${afterCaptchaUrl}`);
    
    // Wait more and check
    await delay(5000, 8000);
    const finalUrl = page.url();
    console.log(`📍 Final URL: ${finalUrl}`);
  }

  // Step 6: Check for 2FA page
  const currentUrl = page.url();
  if (currentUrl.includes("two_step") || currentUrl.includes("checkpoint")) {
    console.log("🔐 2FA PAGE DETECTED — đây là nơi em bị chặn!");
    await page.screenshot({ path: path.join(LOG_DIR, "debug-5-2fa-page.png") });
    console.log("📸 Screenshot 5: 2FA page — CẦN MÃ XÁC THỰC");
    
    // Try to find alternative: "Try another way" link
    const altSelectors = [
      'a:has-text("Thử cách khác")',
      'a:has-text("Try another way")',
      'a:has-text("trouble")',
      'a:has-text("khác")',
      'text="Gửi mã qua SMS"',
      'text="Gửi mã qua email"',
      'text="Text me a code"',
      'text="Email me a code"',
    ];
    
    for (const sel of altSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          console.log(`🔗 Found alternative: ${sel}`);
          const text = await el.textContent();
          console.log(`   Text: ${text}`);
        }
      } catch {}
    }
    
    // Look for ALL links and buttons on page
    const links = await page.$$eval('a, button, div[role="button"]', els => 
      els.map(e => ({ tag: e.tagName, text: e.textContent?.slice(0, 50), href: (e as any).href || "" })).filter(e => e.text && e.text.length > 1)
    );
    console.log("\n📋 Tất cả links/buttons trên trang 2FA:");
    links.forEach(l => console.log(`  [${l.tag}] "${l.text}" → ${l.href}`));
    
  } else if (!currentUrl.includes("login")) {
    console.log("✅ CÓ VẺ ĐÃ VÀO ĐƯỢC!");
    await page.screenshot({ path: path.join(LOG_DIR, "debug-6-success.png") });
    
    // Save cookies
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log(`🍪 Saved ${cookies.length} cookies`);
  }

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
