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
  console.log("🦊 Login + Wait for full JS render + Click 'Thử cách khác'");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
    javaScriptEnabled: true,
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  // Login
  console.log("🔐 Login...");
  await page.goto("https://www.facebook.com/login", { waitUntil: "networkidle", timeout: 60000 });
  await delay(2000, 3000);

  await page.fill('input[name="email"]', "onlyfan131313@gmail.com");
  await delay(300, 600);
  await page.fill('input[name="pass"]', "@Awaken13");
  await delay(500, 1000);
  await page.keyboard.press("Enter");
  
  console.log("⏳ Waiting for page to load fully...");
  // Wait longer for full JS render
  await page.waitForLoadState("networkidle").catch(() => {});
  await delay(8000, 12000);

  let url = page.url();
  console.log(`📍 URL: ${url}`);

  // Handle CAPTCHA
  for (const frame of page.frames()) {
    if (frame.url().includes("recaptcha")) {
      console.log("🤖 CAPTCHA found!");
      try {
        const cb = await frame.$('#recaptcha-anchor, [role="checkbox"]');
        if (cb) { await cb.click(); console.log("✅ CAPTCHA clicked"); }
      } catch {}
      await delay(5000, 8000);
    }
  }

  // Wait again for full render after CAPTCHA
  await page.waitForLoadState("networkidle").catch(() => {});
  await delay(5000, 8000);

  url = page.url();
  console.log(`📍 After CAPTCHA URL: ${url}`);

  // Screenshot
  await page.screenshot({ path: path.join(LOG_DIR, "v2-step1.png") });

  // Check if we're on 2FA page
  if (url.includes("two_step") || url.includes("checkpoint")) {
    console.log("🔐 On 2FA page. Full JS render, looking for elements...");
    
    // Wait extra for React to render
    await delay(5000, 8000);
    
    // Get ALL text on page using innerText (not textContent - catches rendered text)
    const pageText = await page.evaluate(() => document.body.innerText);
    console.log(`📄 Page innerText:\n${pageText.slice(0, 2000)}`);
    
    // Get all clickable elements
    const clickables = await page.evaluate(() => {
      const els = document.querySelectorAll('a, button, div[role="button"], span[role="link"], [tabindex="0"]');
      return Array.from(els).map((el, i) => ({
        i,
        tag: el.tagName,
        text: (el as HTMLElement).innerText?.trim().slice(0, 80) || "",
        role: el.getAttribute("role") || "",
        href: (el as HTMLAnchorElement).href || "",
        className: el.className?.slice(0, 50) || "",
      })).filter(e => e.text.length > 0);
    });
    
    console.log("\n🔍 Clickable elements:");
    for (const el of clickables) {
      console.log(`  [${el.i}] <${el.tag}> role="${el.role}" text="${el.text}" href="${el.href.slice(0, 60)}"`);
    }

    // Find and click "Thử cách khác" or similar
    const targetTexts = [
      /thử cách khác/i,
      /try another/i, 
      /another way/i,
      /cách khác/i,
      /need another/i,
      /having trouble/i,
      /gặp sự cố/i,
      /didn't get a code/i,
      /không nhận được/i,
    ];

    for (const el of clickables) {
      for (const pattern of targetTexts) {
        if (pattern.test(el.text)) {
          console.log(`\n🎯 MATCH: [${el.i}] "${el.text}"`);
          // Click it
          const elements = await page.$$('a, button, div[role="button"], span[role="link"], [tabindex="0"]');
          if (elements[el.i]) {
            await elements[el.i].click();
            console.log("✅ CLICKED!");
            await delay(5000, 8000);
            
            await page.screenshot({ path: path.join(LOG_DIR, "v2-step2-clicked.png") });
            
            // Check new page
            const newText = await page.evaluate(() => document.body.innerText);
            console.log(`\n📄 After click:\n${newText.slice(0, 1500)}`);
            
            const newClickables = await page.evaluate(() => {
              const els = document.querySelectorAll('a, button, div[role="button"], [tabindex="0"]');
              return Array.from(els).map((el, i) => ({
                i,
                text: (el as HTMLElement).innerText?.trim().slice(0, 80) || "",
              })).filter(e => e.text.length > 0);
            });
            console.log("\n🔍 New clickable elements:");
            for (const ne of newClickables) {
              console.log(`  [${ne.i}] "${ne.text}"`);
            }
            
            break;
          }
        }
      }
    }
  }

  // Final
  url = page.url();
  console.log(`\n📍 FINAL URL: ${url}`);
  await page.screenshot({ path: path.join(LOG_DIR, "v2-final.png") });

  if (!url.includes("login") && !url.includes("checkpoint") && !url.includes("two_step")) {
    console.log("✅✅✅ LOGGED IN!");
    const cookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies, null, 2));
    console.log(`🍪 Saved ${cookies.length} cookies`);
  }

  await browser.close();
  console.log("🔒 Done");
}

main().catch(console.error);
