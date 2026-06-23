import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

const TEXT = process.env.POST_TEXT || "Test post from Tiểu Tâm 🦊";

function getRandomImage(): string {
  const files = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  return path.join(ALBUM_DIR, files[Math.floor(Math.random() * files.length)]);
}

async function main() {
  console.log("🦊 POST NOW — đăng lên tường");

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

  // Step 1: Go to profile
  console.log("👤 Going to profile...");
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  if (page.url().includes("login")) { console.log("❌ Cookies expired!"); await browser.close(); return; }

  // Step 2: Click composer
  console.log("🖱️ Clicking composer...");
  let composerOpened = false;

  // Try clicking "Bạn đang nghĩ gì?"
  try {
    const loc = page.locator('span:has-text("Bạn đang nghĩ gì")');
    if (await loc.count() > 0) {
      await loc.first().click();
      composerOpened = true;
      console.log("  ✅ Clicked composer");
    }
  } catch {}

  if (!composerOpened) {
    // Try evaluate
    composerOpened = await page.evaluate(() => {
      const els = document.querySelectorAll("span, div");
      for (const el of els) {
        if (el.textContent && el.textContent.includes("Bạn đang nghĩ gì")) {
          (el as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
  }

  if (!composerOpened) {
    console.log("❌ Cannot open composer");
    await page.screenshot({ path: path.join(LOG_DIR, "post-no-composer.png") });
    await browser.close();
    return;
  }

  await delay(3000, 5000);
  await page.screenshot({ path: path.join(LOG_DIR, "post-composer-open.png") });

  // Step 3: Find textbox and type
  console.log("✍️ Typing text...");
  const textboxes = await page.$$('div[role="textbox"][contenteditable="true"]');
  console.log("  Found " + textboxes.length + " textboxes");

  let textbox = null;
  for (const tb of textboxes) {
    if (await tb.isVisible()) {
      textbox = tb;
      break;
    }
  }

  if (!textbox) {
    console.log("❌ No visible textbox");
    await browser.close();
    return;
  }

  await textbox.click();
  await delay(500, 1000);
  await page.keyboard.insertText(TEXT);
  console.log("  ✅ Text inserted (" + TEXT.length + " chars)");
  await delay(1000, 2000);

  // Step 4: Attach image
  const imgPath = getRandomImage();
  try {
    // Click photo button in composer
    const photoBtns = await page.$$('div[aria-label*="Ảnh/video"], div[aria-label*="Photo/video"], div[aria-label*="Ảnh"], div[aria-label*="Photo"]');
    console.log("  📷 Photo buttons found: " + photoBtns.length);
    for (const btn of photoBtns) {
      if (await btn.isVisible()) {
        await btn.click();
        console.log("  📷 Clicked photo button: " + await btn.getAttribute("aria-label"));
        await delay(2000, 3000);
        break;
      }
    }

    // Find file input
    const fileInputs = await page.$$('input[type="file"]');
    console.log("  📷 File inputs: " + fileInputs.length);
    for (const fi of fileInputs) {
      const accept = await fi.getAttribute("accept");
      if (accept && accept.includes("image")) {
        await fi.setInputFiles(imgPath);
        console.log("  📷 Attached: " + path.basename(imgPath));
        await delay(3000, 6000);
        break;
      }
    }
  } catch (e: any) {
    console.log("  ⚠️ Image error: " + (e.message || "").substring(0, 60));
  }

  await page.screenshot({ path: path.join(LOG_DIR, "post-before-submit.png") });

  // Step 5: Find and click POST button — THE CRITICAL PART
  console.log("🔍 Finding Post button...");
  
  // Dump ALL buttons in dialog
  const allButtons = await page.evaluate(() => {
    const results: string[] = [];
    const dialog = document.querySelector('div[role="dialog"]');
    const container = dialog || document;
    container.querySelectorAll('div[role="button"], button').forEach(el => {
      const text = (el as HTMLElement).textContent?.trim() || "";
      const label = el.getAttribute("aria-label") || "";
      const disabled = el.getAttribute("aria-disabled");
      if (text.length > 0 && text.length < 30) {
        results.push("text=\"" + text + "\" label=\"" + label + "\" disabled=" + disabled);
      }
    });
    return results;
  });
  console.log("  All buttons:");
  allButtons.forEach(b => console.log("    " + b));

  // Try multiple approaches to click Post
  let posted = false;

  // Approach 1: aria-label
  for (const label of ["Đăng", "Post"]) {
    const btn = await page.$('div[role="dialog"] div[role="button"][aria-label="' + label + '"]');
    if (btn) {
      const disabled = await btn.getAttribute("aria-disabled");
      console.log("  Found button label=\"" + label + "\" disabled=" + disabled);
      if (disabled !== "true") {
        await btn.click({ force: true });
        posted = true;
        console.log("  ✅ Clicked via aria-label: " + label);
        break;
      }
    }
  }

  // Approach 2: text content
  if (!posted) {
    posted = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return false;
      const buttons = dialog.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        const text = (btn as HTMLElement).textContent?.trim();
        if (text === "Đăng" || text === "Post") {
          (btn as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    if (posted) console.log("  ✅ Clicked via evaluate text match");
  }

  // Approach 3: form submit
  if (!posted) {
    try {
      await page.keyboard.press("Tab");
      await delay(500, 1000);
      await page.keyboard.press("Enter");
      posted = true;
      console.log("  ✅ Tried Tab+Enter");
    } catch {}
  }

  await delay(8000, 12000);
  await page.screenshot({ path: path.join(LOG_DIR, "post-after-submit.png") });

  // Verify: check if post appeared
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  const postCheck = await page.evaluate((searchText: string) => {
    const articles = document.querySelectorAll('div[role="article"]');
    for (const art of articles) {
      const text = art.textContent || "";
      if (text.includes(searchText.substring(0, 30))) return true;
    }
    return false;
  }, TEXT.substring(0, 30));

  console.log("\n📊 Post verification: " + (postCheck ? "✅ VISIBLE ON PROFILE" : "❌ NOT FOUND"));
  await page.screenshot({ path: path.join(LOG_DIR, "post-verify.png") });

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
  console.log("🔒 Done");
}
main().catch(console.error);
