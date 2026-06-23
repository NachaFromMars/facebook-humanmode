/**
 * comment_mission.ts — Facebook Comment Mission with NEW cookies
 * Playwright + fresh login session
 */
import { chromium, Page, BrowserContext } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const COOKIE_PATH = "/root/.openclaw/workspace/facebook-data/cookies.json";
const AVATAR_DIR = "/root/.openclaw/workspace/avatars";
const REPORT_PATH = "/root/.openclaw/workspace/facebook-data/comment-report-2026-03-25.md";

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

const PAGES = [
  { name: "Diệp Anh Tuấn", url: "https://www.facebook.com/diepanhtuan999" },
  { name: "Phạm Đặng Anh Thư", url: "https://www.facebook.com/PhamDangAnhThu" },
  { name: "Thích Minh Không", url: "https://www.facebook.com/thich.minh.khong.113523" },
];

const COMMENTS = [
  "Hay quá trời nè 🔥 #TieuTam",
  "Content chất lượng ghê 🫶 #TieuTam",
  "Chuẩn ko cần chỉnh 💯 #TieuTam",
  "Đỉnh nóc kịch trần 🚀 #TieuTam",
  "Xem hoài ko chán 🤩 #TieuTam",
  "Hay quáá cảm ơn 🌸 #TieuTam",
  "Đúng ý em luôn 💕 #TieuTam",
  "Bài viết có tâm 🫶 #TieuTam",
  "Nội dung xịn xò quá 👍 #TieuTam",
  "Follow để đón bài mới 🥰 #TieuTam",
  "Hay dữ vậy trời 😍 #TieuTam",
  "Save lại liền tay 📌 #TieuTam",
  "Đọc mà gật đầu hoài 🤭 #TieuTam",
  "Lan toả năng lượng tích cực 🌈 #TieuTam",
  "Content kiểu này hiếm lắm 💎 #TieuTam",
  "Ủa sao giỏi dữ vậy 🙌 #TieuTam",
  "Em ghiền luôn rồi á 😆 #TieuTam",
  "Share cho bạn bè đọc 📣 #TieuTam",
  "Like mạnh nha bạn ơi 💪 #TieuTam",
  "Vibe bài này cuốn quá 🌊 #TieuTam",
];

const REPLIES = [
  "Đồng ý bạn nha 👍 #TieuTam",
  "Haha đúng rồi đó 😆 #TieuTam",
  "Bạn nói hay quá 💯 #TieuTam",
  "Ê ý kiến hay ghê 🤩 #TieuTam",
  "Cũng có lý nha 🫶 #TieuTam",
  "Đúng ý em luôn ❤️ #TieuTam",
  "Nghĩ giống em quá 🤭 #TieuTam",
  "Oke bạn nha 🦊 #TieuTam",
  "Hay nè hay nè 🌸 #TieuTam",
  "Gật đầu liền luôn 🙌 #TieuTam",
];

const used = new Set<string>();
function pickComment(): string {
  const avail = COMMENTS.filter(c => !used.has(c));
  if (avail.length === 0) { used.clear(); return pick(COMMENTS); }
  const c = pick(avail); used.add(c); return c;
}

interface ActionLog {
  page: string;
  postIndex: number;
  action: "comment" | "reply";
  text: string;
  success: boolean;
  error?: string;
  time: string;
}

const logs: ActionLog[] = [];

function log(msg: string) {
  const t = new Date().toLocaleTimeString("en-US", { hour12: false });
  console.log(`[${t}] ${msg}`);
}

async function humanType(page: Page, text: string) {
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: 50 + Math.random() * 100 });
    if (Math.random() < 0.03) await delay(rand(200, 500));
  }
}

async function tryComment(page: Page, comment: string): Promise<boolean> {
  // Find comment box
  const boxes = await page.$$('[contenteditable="true"][role="textbox"]');
  if (boxes.length === 0) {
    // Try clicking "Bình luận" / "Comment" button
    const btns = await page.$$('[role="button"]');
    for (const btn of btns) {
      const text = await btn.textContent();
      if (text?.trim() === "Bình luận" || text?.trim() === "Comment") {
        await btn.click({ force: true });
        await delay(2000);
        break;
      }
    }
  }
  
  // Try again after clicking
  const boxes2 = await page.$$('[contenteditable="true"][role="textbox"]');
  if (boxes2.length === 0) {
    log("    ❌ No comment box found");
    return false;
  }

  const box = boxes2[boxes2.length - 1];
  await box.click();
  await delay(500);
  await humanType(page, comment);
  await delay(rand(500, 1000));
  
  // Submit
  await page.keyboard.press("Enter");
  await delay(rand(3000, 5000));
  
  return true;
}

async function tryReply(page: Page, replyText: string): Promise<boolean> {
  // Find reply buttons
  const btns = await page.$$('[role="button"]');
  let replyBtn = null;
  for (const btn of btns) {
    const text = await btn.textContent();
    if (text?.trim() === "Phản hồi" || text?.trim() === "Reply") {
      replyBtn = btn;
      break;
    }
  }
  
  if (!replyBtn) return false;
  
  await replyBtn.click({ force: true });
  await delay(2000);
  
  const boxes = await page.$$('[contenteditable="true"][role="textbox"]');
  if (boxes.length === 0) return false;
  
  const box = boxes[boxes.length - 1];
  await box.click();
  await delay(500);
  await humanType(page, replyText);
  await delay(rand(500, 1000));
  await page.keyboard.press("Enter");
  await delay(rand(3000, 5000));
  
  return true;
}

function writeReport() {
  let md = `# 📋 Facebook Comment Report — 2026-03-25\n\n`;
  md += `**Thời gian:** ${ts()}\n`;
  md += `**Tài khoản:** Họ Tieu Tên Tâm\n\n`;

  for (const pn of PAGES.map(p => p.name)) {
    const pLogs = logs.filter(l => l.page === pn);
    const comments = pLogs.filter(l => l.action === "comment");
    const replies = pLogs.filter(l => l.action === "reply");
    const ok = pLogs.filter(l => l.success);
    
    md += `## 📌 ${pn}\n`;
    md += `- ✅ Comments: ${comments.filter(l => l.success).length}/${comments.length}\n`;
    md += `- ↩️ Replies: ${replies.filter(l => l.success).length}/${replies.length}\n`;
    md += `- Total: ${ok.length}/${pLogs.length}\n\n`;

    for (const l of pLogs) {
      const icon = l.success ? "✅" : "❌";
      md += `${icon} [Post ${l.postIndex}] ${l.action}: "${l.text.slice(0, 40)}..."\n`;
    }
    md += "\n";
  }

  md += `---\n_Generated by Tiểu Tâm 🦊_\n`;
  fs.writeFileSync(REPORT_PATH, md, "utf-8");
  log(`📋 Report saved`);
}

async function main() {
  log("🦊 TIỂU TÂM FACEBOOK COMMENT MISSION");
  log("═══════════════════════════════════════");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366 + randInt(-30, 30), height: 768 + randInt(-30, 30) },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  log(`🍪 ${cookies.length} cookies loaded`);

  const page = await context.newPage();

  // Verify login
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000);
  
  const bodyText = await page.evaluate(() => (document.body?.innerText || "").slice(0, 200));
  const loggedIn = bodyText.includes("Tìm bạn bè") || bodyText.includes("Menu") || bodyText.includes("Marketplace");
  
  if (!loggedIn) {
    log("❌ NOT LOGGED IN! Aborting.");
    log(`Body: ${bodyText.slice(0, 100)}`);
    await browser.close();
    return;
  }
  log("✅ Logged in!");

  // Process each page
  for (let pi = 0; pi < PAGES.length; pi++) {
    const pageInfo = PAGES[pi];
    log(`\n${"═".repeat(50)}`);
    log(`📌 PAGE ${pi + 1}/3: ${pageInfo.name}`);
    log(`${"═".repeat(50)}`);

    await page.goto(pageInfo.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(rand(5000, 7000));

    // Scroll to load posts
    for (let i = 0; i < 6; i++) {
      await page.evaluate(() => window.scrollBy(0, 800));
      await delay(rand(1500, 2500));
    }

    // Find post links
    const postUrls = await page.evaluate(() => {
      const seen = new Set<string>();
      return [...document.querySelectorAll('a[href*="/posts/"], a[href*="story_fbid"]')]
        .map(a => (a as HTMLAnchorElement).href.split("?")[0])
        .filter(h => { if (seen.has(h)) return false; seen.add(h); return true; })
        .slice(0, 5);
    });

    log(`  Found ${postUrls.length} posts`);

    if (postUrls.length === 0) {
      log("  ⚠️ No posts, skipping");
      continue;
    }

    // Process each post — 2 comments + 1 reply
    for (let ppi = 0; ppi < Math.min(postUrls.length, 3); ppi++) {
      const postUrl = postUrls[ppi];
      log(`\n  📝 Post ${ppi + 1}: ...${postUrl.slice(-30)}`);

      await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await delay(rand(4000, 6000));

      // 2 comments
      for (let ci = 0; ci < 2; ci++) {
        const comment = pickComment();
        log(`    💬 Comment ${ci + 1}: "${comment.slice(0, 35)}..."`);
        
        const ok = await tryComment(page, comment);
        logs.push({
          page: pageInfo.name,
          postIndex: ppi + 1,
          action: "comment",
          text: comment,
          success: ok,
          time: ts(),
        });
        
        if (ok) log(`      ✅ Posted!`);
        else log(`      ❌ Failed`);
        
        await delay(rand(10000, 18000));
      }

      // 1 reply
      const replyText = pick(REPLIES);
      log(`    ↩️ Reply: "${replyText.slice(0, 35)}..."`);
      const replyOk = await tryReply(page, replyText);
      logs.push({
        page: pageInfo.name,
        postIndex: ppi + 1,
        action: "reply",
        text: replyText,
        success: replyOk,
        time: ts(),
      });
      if (replyOk) log(`      ✅ Replied!`);
      else log(`      ❌ No reply button`);

      // Delay between posts
      await delay(rand(25000, 45000));
      
      // Save intermediate report
      writeReport();
    }

    // Delay between pages
    if (pi < PAGES.length - 1) {
      const waitMin = randInt(2, 4);
      log(`\n⏳ Waiting ${waitMin} minutes before next page...`);
      await delay(waitMin * 60000);
    }
  }

  writeReport();

  // Stats
  const totalOk = logs.filter(l => l.success).length;
  const totalComments = logs.filter(l => l.action === "comment" && l.success).length;
  const totalReplies = logs.filter(l => l.action === "reply" && l.success).length;
  log(`\n${"═".repeat(50)}`);
  log(`🦊 MISSION COMPLETE`);
  log(`📊 ${totalComments} comments + ${totalReplies} replies = ${totalOk} total`);
  log(`📋 Report: ${REPORT_PATH}`);

  await browser.close();
}

main().catch(err => {
  log(`💥 FATAL: ${err.message}`);
  writeReport();
  process.exit(1);
});
