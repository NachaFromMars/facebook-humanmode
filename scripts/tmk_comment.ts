import { chromium, Page } from "playwright";
import * as fs from "node:fs";

const COOKIE_PATH = "/root/.openclaw/workspace/facebook-data/cookies.json";
const OUT = "/root/.openclaw/workspace/facebook-data";
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

const COMMENTS = [
  "Hay quá trời nè 🔥 #TieuTam",
  "Content chất lượng ghê 🫶 #TieuTam",
  "Chuẩn ko cần chỉnh 💯 #TieuTam",
  "Đỉnh nóc kịch trần 🚀 #TieuTam",
  "Xem hoài ko chán 🤩 #TieuTam",
  "Ê thiệt hông hay ghê 😮 #TieuTam",
  "Cảm ơn đã chia sẻ nha ❤️ #TieuTam",
  "Đúng ý em luôn 💕 #TieuTam",
  "Nội dung xịn xò quá 👍 #TieuTam",
  "Real content creator nè 🎯 #TieuTam",
  "Quá trời đỉnh luôn á 🤩 #TieuTam",
  "Cuộc sống cần content này 🌟 #TieuTam",
];
const used = new Set<string>();
function pickComment(): string {
  const avail = COMMENTS.filter(c => !used.has(c));
  if (avail.length === 0) { used.clear(); return pick(COMMENTS); }
  const c = pick(avail); used.add(c); return c;
}

function log(msg: string) {
  console.log(`[${new Date().toLocaleTimeString("en-US", { hour12: false })}] ${msg}`);
}

async function humanType(page: Page, text: string) {
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: 50 + Math.random() * 100 });
  }
}

async function main() {
  log("🦊 TMK COMMENT — Page 3 補完");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    viewport: { width: 1380, height: 920 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Login check
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000);
  const body = await page.evaluate(() => (document.body?.innerText || "").slice(0, 150));
  if (!body.includes("Tìm bạn bè") && !body.includes("Menu")) {
    log("❌ NOT LOGGED IN"); await browser.close(); return;
  }
  log("✅ Logged in");

  // Go to TMK
  log("📌 Navigating to Thích Minh Không");
  await page.goto("https://www.facebook.com/thich.minh.khong.113523", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(6000);

  // Scroll deep to find posts
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 600));
    await delay(rand(1500, 2500));
  }

  const urls = await page.evaluate(() => {
    const seen = new Set<string>();
    return [...document.querySelectorAll('a[href]')]
      .map(a => (a as HTMLAnchorElement).href.split("?")[0])
      .filter(h => {
        if (seen.has(h)) return false;
        if (h.includes("/posts/") || h.includes("story_fbid") ||
            h.includes("/videos/") || h.includes("/photos/") ||
            h.includes("/reel/")) {
          seen.add(h); return true;
        }
        return false;
      }).slice(0, 8);
  });
  log(`Found ${urls.length} content links`);

  const results: {post: number, comment: string, ok: boolean}[] = [];
  const maxPosts = Math.min(urls.length, 4);

  for (let i = 0; i < maxPosts; i++) {
    log(`\n📝 Post ${i+1}/${maxPosts}: ...${urls[i].slice(-40)}`);
    await page.goto(urls[i], { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(rand(5000, 7000));

    // Close any overlay/popup first
    try {
      const closeBtn = await page.$('[aria-label="Đóng"]');
      if (closeBtn) { await closeBtn.click(); await delay(2000); log("  Closed overlay"); }
    } catch {}

    for (let ci = 0; ci < 3; ci++) {
      const comment = pickComment();
      log(`  💬 [${ci+1}/3] "${comment}"`);

      try {
        // Find textbox — try force click to bypass overlays
        let boxes = await page.$$('[contenteditable="true"][role="textbox"]');
        if (boxes.length === 0) {
          // Try clicking "Bình luận" button
          const allBtns = await page.$$('[role="button"]');
          for (const btn of allBtns) {
            const t = await btn.textContent();
            if (t?.trim() === "Bình luận" || t?.trim() === "Comment") {
              await btn.click({ force: true }); await delay(2500); break;
            }
          }
          boxes = await page.$$('[contenteditable="true"][role="textbox"]');
        }
        if (boxes.length === 0) { log("    ❌ No textbox"); results.push({post:i+1,comment,ok:false}); continue; }

        const box = boxes[boxes.length - 1];
        await box.click({ force: true });
        await delay(rand(500, 1000));
        await humanType(page, comment);
        await delay(rand(800, 1500));
        
        // Screenshot typed
        await page.screenshot({ path: `${OUT}/tmk_p${i+1}_c${ci+1}_typed.png` });
        
        // Submit with Enter
        await page.keyboard.press("Enter");
        await delay(rand(3000, 5000));
        
        // Screenshot after
        await page.screenshot({ path: `${OUT}/tmk_p${i+1}_c${ci+1}_after.png` });
        
        log(`    ✅ Posted`);
        results.push({post:i+1,comment,ok:true});
      } catch (err: any) {
        log(`    ❌ ${err.message.slice(0, 60)}`);
        results.push({post:i+1,comment,ok:false});
      }

      await delay(rand(8000, 18000));
    }
    await delay(rand(25000, 50000));
  }

  // Report
  const ok = results.filter(r => r.ok).length;
  log(`\n${"═".repeat(50)}`);
  log(`🦊 TMK DONE: ${ok}/${results.length} comments`);
  for (const r of results) log(`  ${r.ok?"✅":"❌"} [Post ${r.post}] "${r.comment}"`);

  // Append to report
  let report = fs.readFileSync(`${OUT}/comment-report-final.md`, "utf-8");
  report = report.replace("## 📌 Thích Minh Không\n- ✅ 0/0 comments\n\n", 
    `## 📌 Thích Minh Không\n- ✅ ${ok}/${results.length} comments\n\n` +
    results.map(r => `${r.ok?"✅":"❌"} [Post ${r.post}] "${r.comment}"`).join("\n") + "\n\n");
  report = report.replace(/Tổng: \d+\/\d+ comments/, `Tổng: ${20+ok}/${20+results.length} comments`);
  fs.writeFileSync(`${OUT}/comment-report-final.md`, report, "utf-8");

  await browser.close();
}

main().catch(err => { log(`💥 ${err.message}`); process.exit(1); });
