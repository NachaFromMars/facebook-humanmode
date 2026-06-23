import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");
const STORIES_PATH = path.join(__dirname, "..", "data", "stories", "ba-cuoc-goi-nho-parts.json");

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
const rnd = (min: number, max: number) => min + Math.random() * (max - min);

async function main() {
  const beatNum = parseInt(process.env.BEAT || "1", 10) - 1; // 0-indexed
  const beats = JSON.parse(fs.readFileSync(STORIES_PATH, "utf-8"));
  const beat = beats[beatNum];
  if (!beat) { console.log("No beat " + (beatNum+1)); process.exit(1); }

  const questions = [
    "bạn đã bao giờ nhìn điện thoại reo mà không dám bắt máy chưa?",
    "năm năm không liên lạc — là quên, là giận, hay là sợ?",
    "cái 'không bao giờ biết' và cái 'biết rồi ước gì không biết' — cái nào đau hơn?",
    "mẹ gọi lúc 11 đêm. bạn có bắt máy không? thật lòng.",
    "bốn chữ 'mẹ nhớ con' — đơn giản vậy mà sao nặng vậy?",
    "có ai trong đời bạn giống cô Ngọc không? người tốt mà mình cứ 'để mai rồi tính'?",
    "một bữa cơm. chỉ một bữa cơm thôi. bạn có đang nợ ai một bữa cơm không?",
    "điện thoại reo. số lạ. bạn có bắt máy không — hay lại chọn nút đỏ?",
  ];

  // Build post content with question + updated hashtags
  const hashtags = "#tieutam #nho #ai #minhtue #phatphap #BaCuocGoiNho";
  const question = questions[beatNum] || "";
  const fullText = beat.title + "\n\n" + beat.body.replace(/#TieuTam.*$/, "").trim() + "\n\n" + (question ? "💭 " + question + "\n\n" : "") + hashtags;

  // Pick random image
  const images = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  const imgFile = images[Math.floor(Math.random() * images.length)];
  const imgPath = path.join(ALBUM_DIR, imgFile);

  console.log(`🦊 Beat ${beatNum+1}/8: ${beat.title.substring(0, 50)}...`);
  console.log(`📷 Image: ${imgFile}`);
  console.log(`📝 Text length: ${fullText.length} chars`);

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-sandbox"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366 + Math.floor(Math.random()*50-25), height: 768 + Math.floor(Math.random()*50-25) },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);

  const page = await context.newPage();

  try {
    // Go to profile
    console.log("[1] Loading profile...");
    await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(rnd(5000, 7000));

    if (page.url().includes("login")) {
      console.log("❌ Cookie expired!");
      await page.screenshot({ path: path.join(LOG_DIR, `beat${beatNum+1}-login-fail.png`) });
      await browser.close();
      process.exit(1);
    }
    console.log("✅ Profile loaded: " + page.url());

    // Scroll to look natural
    await page.evaluate(() => window.scrollBy(0, 300));
    await delay(rnd(1500, 2500));
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(rnd(2000, 3000));

    // Click composer
    console.log("[2] Opening composer...");
    let clicked = false;
    try {
      const loc = page.locator("text=Bạn đang nghĩ gì");
      if (await loc.count() > 0) { await loc.first().click(); clicked = true; }
    } catch {}
    if (!clicked) {
      clicked = await page.evaluate(() => {
        for (const s of document.querySelectorAll("span")) {
          if (s.textContent?.includes("Bạn đang nghĩ gì")) { (s as HTMLElement).click(); return true; }
        }
        return false;
      });
    }
    if (!clicked) {
      console.log("❌ Composer not found");
      await page.screenshot({ path: path.join(LOG_DIR, `beat${beatNum+1}-no-composer.png`) });
      await browser.close();
      process.exit(1);
    }
    console.log("✅ Composer opened");
    await delay(rnd(3000, 5000));

    // Find textbox and type
    console.log("[3] Typing content...");
    // Use page.locator instead of page.$ to avoid cross-document issues
    const tbLocator = page.locator('div[role="textbox"][contenteditable="true"]').first();
    try {
      await tbLocator.waitFor({ state: "visible", timeout: 10000 });
      await tbLocator.click();
    } catch {
      console.log("❌ No textbox");
      await page.screenshot({ path: path.join(LOG_DIR, `beat${beatNum+1}-no-tb.png`) });
      await browser.close();
      process.exit(1);
    }
    await delay(rnd(500, 1000));
    await page.keyboard.insertText(fullText);
    console.log(`✅ Text inserted (${fullText.length} chars)`);
    await delay(rnd(1500, 2500));

    // Attach image
    console.log("[4] Attaching image...");
    try {
      const photoBtn = await page.$('div[role="dialog"] [aria-label*="Ảnh"], div[role="dialog"] [aria-label*="Photo"]');
      if (photoBtn) {
        await photoBtn.click();
        console.log("✅ Clicked photo button");
        await delay(rnd(1500, 2500));
      }
      const fileInput = await page.$('input[type="file"][accept*="image"]');
      if (fileInput) {
        await fileInput.setInputFiles(imgPath);
        console.log(`✅ Image attached: ${imgFile}`);
        await delay(rnd(4000, 6000));
      }
    } catch (e: any) {
      console.log("⚠️ Image attach failed: " + (e.message || "").substring(0, 80));
    }

    // Screenshot before posting
    await page.screenshot({ path: path.join(LOG_DIR, `beat${beatNum+1}-before-post.png`) });

    // Click "Tiếp" (Professional mode has 2-step flow)
    console.log("[5] Clicking Tiếp...");
    const tiepBtn = await page.$('[aria-label="Tiếp"]');
    if (tiepBtn) {
      await tiepBtn.click();
      console.log("✅ Clicked Tiếp");
      await delay(rnd(3000, 5000));
    } else {
      console.log("⚠️ No Tiếp button - trying Đăng directly");
    }

    // Click "Đăng"
    console.log("[6] Clicking Đăng...");
    let posted = false;

    // Method 1: aria-label
    for (const label of ["Đăng", "Post"]) {
      const btn = await page.$(`[aria-label="${label}"]`);
      if (btn) {
        const disabled = await btn.getAttribute("aria-disabled");
        if (disabled !== "true") {
          await btn.click({ force: true });
          posted = true;
          console.log(`✅ Clicked [${label}]`);
          break;
        }
      }
    }

    // Method 2: text search
    if (!posted) {
      posted = await page.evaluate(() => {
        const btns = document.querySelectorAll('[role="button"]');
        for (const btn of btns) {
          const label = btn.getAttribute("aria-label");
          if ((label === "Đăng" || label === "Post") && btn.getAttribute("aria-disabled") !== "true" && (btn as HTMLElement).offsetParent) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      if (posted) console.log("✅ Clicked via evaluate");
    }

    if (!posted) {
      console.log("❌ Could not find Đăng button");
      await page.screenshot({ path: path.join(LOG_DIR, `beat${beatNum+1}-no-post-btn.png`) });
    }

    // Wait for post to complete
    await delay(rnd(8000, 12000));

    // Screenshot after posting
    await page.screenshot({ path: path.join(LOG_DIR, `beat${beatNum+1}-after-post.png`) });

    // Verify by checking if dialog closed
    const dialogOpen = await page.$('div[role="dialog"]');
    if (!dialogOpen) {
      console.log("✅ Dialog closed — POST SUCCESSFUL!");
    } else {
      // Check if dialog is still the composer or something else
      const dialogText = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"]');
        return d ? d.textContent?.substring(0, 100) || "" : "none";
      });
      console.log(`⚠️ Dialog still open: ${dialogText.substring(0, 60)}...`);
    }

    // Navigate to profile to verify + screenshot
    console.log("[7] Verifying on profile...");
    await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(rnd(5000, 7000));
    await page.screenshot({ path: path.join(LOG_DIR, `beat${beatNum+1}-profile-verify.png`) });

    // Check if our text is on the page
    const postFound = await page.evaluate((searchText: string) => {
      return document.body.innerText.includes(searchText);
    }, "Điện thoại reo");
    console.log(`Profile verification: ${postFound ? "✅ POST FOUND!" : "❌ Post not found"}`);

    // Save updated cookies
    const newCookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));

    console.log(`\n🦊 Beat ${beatNum+1}/8 ${postFound ? "SUCCESS ✅" : "NEEDS CHECK ⚠️"}`);

  } finally {
    await browser.close();
  }
}

main().catch(e => { console.error("💀 Error:", e.message); process.exit(1); });
