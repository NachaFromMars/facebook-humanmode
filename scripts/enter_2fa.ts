import { initBrowser, loadConfig, saveCookies } from "./fb_core.js";
import { humanType, humanClick, randomDelay } from "./humanmode.js";
import * as fs from "node:fs";

const CODE = "928629";

async function main() {
  const config = loadConfig();
  const session = await initBrowser(config);
  
  try {
    // Navigate to login
    console.log("🔐 Login lại...");
    await session.page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(2000, 3000);
    
    // Type email
    await humanClick(session.page, 'input[name="email"]');
    await humanType(session.page, 'input[name="email"]', "onlyfan131313@gmail.com");
    await randomDelay(500, 1000);
    
    // Type password
    await humanClick(session.page, 'input[name="pass"]');
    await humanType(session.page, 'input[name="pass"]', "@Awaken13");
    await randomDelay(500, 1000);
    
    // Click login - try multiple selectors
    const loginSelectors = [
      'div[role="button"]:has-text("Đăng nhập")',
      'div[role="button"]:has-text("Log in")',
      'button[name="login"]',
      'button[type="submit"]',
      'button:has-text("Log In")',
    ];
    
    for (const sel of loginSelectors) {
      try {
        const el = await session.page.waitForSelector(sel, { timeout: 3000, state: "visible" });
        if (el) {
          await humanClick(session.page, sel);
          console.log(`🖱️ Clicked: ${sel}`);
          break;
        }
      } catch {}
    }
    
    console.log("⏳ Đợi 2FA page...");
    await randomDelay(5000, 8000);
    
    const url = session.page.url();
    console.log(`📍 URL: ${url}`);
    
    // Take screenshot
    await session.page.screenshot({ path: "./data/logs/2fa-page.png" });
    
    // Look for 2FA input
    const codeSelectors = [
      'input[name="approvals_code"]',
      '#approvals_code',
      'input[aria-label*="code" i]',
      'input[aria-label*="mã" i]',
      'input[type="text"]',
      'input[type="tel"]',
      'input[autocomplete="one-time-code"]',
    ];
    
    let codeInput = null;
    for (const sel of codeSelectors) {
      try {
        const el = await session.page.waitForSelector(sel, { timeout: 3000, state: "visible" });
        if (el) {
          codeInput = sel;
          console.log(`✅ Found 2FA input: ${sel}`);
          break;
        }
      } catch {}
    }
    
    if (!codeInput) {
      console.log("⚠️ Không tìm thấy ô nhập 2FA, thử tìm bất kỳ input nào...");
      // Try any visible input on the page
      const allInputs = await session.page.$$('input:visible');
      console.log(`Found ${allInputs.length} visible inputs`);
      if (allInputs.length > 0) {
        await allInputs[0].click();
        await randomDelay(500, 1000);
        await allInputs[0].fill('');
        await humanType(session.page, allInputs[0], CODE);
      }
    } else {
      await humanClick(session.page, codeInput);
      await randomDelay(500, 1000);
      await humanType(session.page, codeInput, CODE);
    }
    
    console.log(`⌨️ Đã nhập mã: ${CODE}`);
    await randomDelay(1000, 2000);
    
    // Take screenshot after entering code
    await session.page.screenshot({ path: "./data/logs/2fa-entered.png" });
    
    // Click submit/continue
    const submitSelectors = [
      'div[role="button"]:has-text("Continue")',
      'div[role="button"]:has-text("Tiếp tục")',
      'div[role="button"]:has-text("Submit")',
      'div[role="button"]:has-text("Gửi")',
      'button[type="submit"]',
      'button:has-text("Continue")',
      'button:has-text("Tiếp tục")',
    ];
    
    for (const sel of submitSelectors) {
      try {
        const el = await session.page.waitForSelector(sel, { timeout: 2000, state: "visible" });
        if (el) {
          await humanClick(session.page, sel);
          console.log(`🖱️ Clicked submit: ${sel}`);
          break;
        }
      } catch {}
    }
    
    // Also try Enter key
    await session.page.keyboard.press("Enter");
    
    console.log("⏳ Đợi kết quả...");
    await randomDelay(8000, 12000);
    
    const finalUrl = session.page.url();
    console.log(`📍 Final URL: ${finalUrl}`);
    
    // Screenshot
    await session.page.screenshot({ path: "./data/logs/2fa-result.png" });
    
    if (!finalUrl.includes("login") && !finalUrl.includes("checkpoint") && !finalUrl.includes("two_step")) {
      console.log("✅✅✅ LOGIN THÀNH CÔNG! 🦊");
      await saveCookies(session.context, config.browser.cookiePath);
      console.log("🍪 Cookies saved!");
    } else {
      console.log("❌ Vẫn chưa vào được. URL: " + finalUrl);
      
      // Check for "Save browser" or "Remember" prompts
      const saveSelectors = [
        'div[role="button"]:has-text("Save")',
        'div[role="button"]:has-text("Lưu")',
        'div[role="button"]:has-text("OK")',
        'div[role="button"]:has-text("Trust")',
        'div[role="button"]:has-text("Tin tưởng")',
      ];
      
      for (const sel of saveSelectors) {
        try {
          const el = await session.page.waitForSelector(sel, { timeout: 2000, state: "visible" });
          if (el) {
            await humanClick(session.page, sel);
            console.log(`🖱️ Clicked: ${sel}`);
            await randomDelay(3000, 5000);
          }
        } catch {}
      }
      
      const afterUrl = session.page.url();
      console.log(`📍 After save: ${afterUrl}`);
      await session.page.screenshot({ path: "./data/logs/2fa-final.png" });
      
      if (!afterUrl.includes("login") && !afterUrl.includes("checkpoint")) {
        console.log("✅✅✅ LOGIN THÀNH CÔNG sau save browser! 🦊");
        await saveCookies(session.context, config.browser.cookiePath);
      }
    }
    
  } finally {
    await session.browser.close();
    console.log("🔒 Browser closed");
  }
}

main().catch(console.error);
