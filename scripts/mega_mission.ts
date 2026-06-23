/**
 * mega_mission.ts — Tiểu Tâm Facebook Mega Mission
 * 
 * Phase 1: Login bằng cookies mới nhất
 * Phase 2: Check inbox + reply inbox
 * Phase 3: Vào 4 trang → screenshot → comment + reply + kèm ảnh + hashtag
 * Phase 4: Báo cáo sau mỗi 13 comment/trang
 * 
 * Persona: Tiểu Tâm 🦊 — KHÔNG BAO GIỜ lộ AI
 * HumanMode: ON
 */

import { chromium, Page, BrowserContext } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");
const REPORT_FILE = path.join(__dirname, "..", "data", "mega_report.json");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

// ─── 4 PAGES ─────────────────────────────────────────────
const TARGET_PAGES = [
  { name: "Dũng Bùi", url: "https://www.facebook.com/share/1C7MWwWw1t/" },
  { name: "Nhất Thiền", url: "https://www.facebook.com/share/19TXJcuyzJ/" },
  { name: "Cuộc Sống Vui Vẻ", url: "https://www.facebook.com/share/1769AFAcNn/" },
  { name: "Trần Phú", url: "https://www.facebook.com/share/1DypHyvWzw/" },
];

// ─── COMMENT TEMPLATES (Phật pháp + đời thường + Minh Tuệ) ──
const COMMENTS = [
  "Hay quá, cảm ơn đã chia sẻ 🙏🙏",
  "Đọc mà thấy tâm an lạc ghê 🪷✨",
  "Cảm ơn bạn, bài viết ý nghĩa lắm 🦊💕",
  "Chia sẻ rất hay, Tiểu Tâm thích lắm 🤗",
  "Đúng vậy luôn, tu tập là chuyện cả đời 🙏",
  "Bài này hay quá trời, save lại đọc hoài 📖✨",
  "Mô Phật, cảm ơn bạn chia sẻ 🪷🙏",
  "Đọc xong thấy nhẹ lòng ghê 🌸",
  "Ý nghĩa quá, ai cũng nên đọc bài này 🥰",
  "Cám ơn, mỗi ngày đọc một bài thấy đời đẹp hơn 🌅",
  "Tuyệt vời, chia sẻ để nhiều người cùng đọc 🙌",
  "Hay lắm bạn ơi, đọc mà rung động 💗",
  "Cảm ơn nha, bài viết chạm tới tâm Tiểu Tâm 🦊🪷",
  "Quá hay, đọc đi đọc lại vẫn thấy hay 📚",
  "Bài này cần được nhiều người biết hơn 🙏✨",
  "Chia sẻ hay quá, Tiểu Tâm ghi nhớ nè 📝🦊",
  "Đúng rồi, sống thiện lành là hạnh phúc nhất 🪷💕",
  "Cảm ơn bạn, Tiểu Tâm học được nhiều điều 🥺🙏",
  "Hay quá trời quá đất luôn 🌏✨",
  "Đọc mà thấm, cảm ơn bạn nhiều nha 🙏💗",
  "Thầy Minh Tuệ là tấm gương sáng 🙏🪷",
  "Tu tập không cần chùa to, cần tâm thanh tịnh 🧘‍♂️✨",
  "Mô Phật, đọc mà thấy lòng bình an 🪷🦊",
  "Sống đơn giản, tâm an lạc — hay quá 🙏",
  "Cảm ơn đã nhắc nhở, Tiểu Tâm ghi nhớ 📝💕",
];

const REPLY_TEMPLATES = [
  "Đúng vậy luôn bạn ơi 🙏",
  "Cảm ơn bạn, nói hay quá 💕",
  "Hehe đồng ý với bạn nè 🦊",
  "Bạn nói đúng ghê 🤗✨",
  "Ừa, Tiểu Tâm cũng nghĩ vậy 🪷",
  "Hay quá bạn ơi 🙌",
  "Đúng rồi á, cảm ơn bạn 🥰",
  "Bạn hiểu sâu ghê, Tiểu Tâm phục 🙏",
  "Haha bạn dễ thương vậy 😆💕",
  "Cảm ơn nha, vui ghê 🦊✨",
];

const HASHTAGS = [
  "#phatphap #tuhanh #anlac",
  "#thichminhtue #tuhanhkhudau #buddha",
  "#phatgiao #tamlinh #binhan",
  "#cuocsong #songthienlanh #phattugoc",
  "#nammoamidaphat #tuhanh #chaythiengioi",
  "#phatphap365 #buddha #dharma",
  "#songchanh #tamthanh #binhan",
  "#thiendinh #tuhanh #chaythien",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomImage(): string | null {
  try {
    const files = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
    if (files.length === 0) return null;
    return path.join(ALBUM_DIR, pickRandom(files));
  } catch { return null; }
}

// ─── Human-like functions ────────────────────────────────
async function humanType(page: Page, text: string) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 50 + Math.random() * 80 });
    if (Math.random() < 0.04) await delay(200, 500);
  }
}

async function humanScroll(page: Page, amount: number = 500) {
  const steps = 3 + Math.floor(Math.random() * 3);
  const stepSize = amount / steps;
  for (let i = 0; i < steps; i++) {
    await page.evaluate((s) => window.scrollBy(0, s), stepSize + (Math.random() * 50 - 25));
    await delay(300, 800);
  }
}

// ─── PHASE 1: LOGIN ──────────────────────────────────────
async function loginWithCookies(context: BrowserContext): Promise<Page> {
  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  console.log(`🍪 Loaded ${cookies.length} cookies`);

  const page = await context.newPage();
  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);

  const url = page.url();
  if (url.includes("login") || url.includes("checkpoint")) {
    throw new Error("❌ Cookies hết hạn! Cần cookies mới.");
  }
  console.log("✅ LOGIN OK!");
  return page;
}

// ─── PHASE 2: CHECK + REPLY INBOX ────────────────────────
async function checkAndReplyInbox(page: Page): Promise<{ checked: number; replied: number }> {
  console.log("\n═══ PHASE 2: CHECK INBOX ═══");
  
  await page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  await page.screenshot({ path: path.join(LOG_DIR, "mega-inbox.png") });
  console.log("📸 Screenshot inbox");

  // Try to find unread messages
  let unreadCount = 0;
  try {
    // Look for unread indicators
    const unreadBadges = await page.$$('[aria-label*="tin nhắn chưa đọc"], [aria-label*="unread"]');
    unreadCount = unreadBadges.length;
    console.log(`📩 Unread messages: ${unreadCount}`);

    // Click first few unread threads and reply
    const threads = await page.$$('div[role="row"], a[role="link"][href*="/messages/t/"]');
    let replied = 0;

    for (let i = 0; i < Math.min(threads.length, 5); i++) {
      try {
        await threads[i].click();
        await delay(3000, 5000);

        // Read last message
        const messages = await page.$$('div[dir="auto"][data-ad-preview]');
        if (messages.length > 0) {
          const lastMsg = await messages[messages.length - 1].textContent();
          console.log(`  💬 Last msg: ${(lastMsg || "").substring(0, 60)}...`);
        }

        // Type reply in message box
        const msgBox = await page.$('div[role="textbox"][aria-label*="Nhắn tin"], div[role="textbox"][contenteditable="true"]');
        if (msgBox) {
          await msgBox.click();
          await delay(500, 1000);
          const reply = pickRandom([
            "Hehe cảm ơn bạn nha 🦊💕",
            "Dạ Tiểu Tâm đây, có gì hông bạn? 🤗",
            "Hello bạn yêu 🦊✨ hôm nay bạn khoẻ hông?",
            "Hihi cảm ơn bạn đã nhắn 💕🌸",
            "Dạ Tiểu Tâm nhận được rồi nha 🦊🙏",
          ]);
          await humanType(page, reply);
          await delay(500, 1000);
          await page.keyboard.press("Enter");
          replied++;
          console.log(`  ✅ Replied thread ${i + 1}`);
          await delay(2000, 4000);
        }
      } catch (e) {
        console.log(`  ⚠️ Thread ${i + 1} error: ${e}`);
      }
    }
    return { checked: threads.length, replied };
  } catch (e) {
    console.log(`⚠️ Inbox error: ${e}`);
    return { checked: 0, replied: 0 };
  }
}

// ─── PHASE 3: VISIT PAGES + COMMENT ─────────────────────
async function visitAndComment(page: Page, targetPage: typeof TARGET_PAGES[0], commentCount: number = 13): Promise<{
  pageName: string;
  comments: number;
  replies: number;
  screenshots: string[];
}> {
  console.log(`\n═══ TRANG: ${targetPage.name} ═══`);
  const screenshots: string[] = [];
  let commentsDone = 0;
  let repliesDone = 0;

  // Navigate to page
  await page.goto(targetPage.url, { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);
  
  const ssName = `mega-page-${targetPage.name.replace(/\s/g, '_')}.png`;
  await page.screenshot({ path: path.join(LOG_DIR, ssName) });
  screenshots.push(ssName);
  console.log(`📸 Screenshot: ${ssName}`);

  // Get actual page URL after redirect
  const pageUrl = page.url();
  console.log(`📍 Actual URL: ${pageUrl}`);

  // Scroll down to find posts
  for (let scroll = 0; scroll < 5; scroll++) {
    await humanScroll(page, 600);
    await delay(1500, 3000);
  }

  // Find posts on the page
  const posts = await page.$$('div[role="article"], div[data-ad-preview="message"]');
  console.log(`📝 Found ${posts.length} posts`);

  // Comment on posts
  for (let i = 0; i < Math.min(posts.length, commentCount) && commentsDone < commentCount; i++) {
    try {
      const post = posts[i];
      
      // Scroll post into view
      await post.scrollIntoViewIfNeeded();
      await delay(1000, 2000);

      // Find comment button
      const commentBtns = await post.$$('div[aria-label*="Bình luận"], div[aria-label*="Comment"], div[aria-label*="comment"], span:has-text("Bình luận")');
      
      let commentBtn = null;
      for (const btn of commentBtns) {
        const text = await btn.textContent();
        if (text && (text.includes("Bình luận") || text.includes("Comment"))) {
          commentBtn = btn;
          break;
        }
      }

      if (!commentBtn) {
        // Try clicking area near like/comment/share bar
        const actionBar = await post.$('div[role="button"]:has-text("Bình luận"), span:has-text("Bình luận")');
        if (actionBar) commentBtn = actionBar;
      }

      if (commentBtn) {
        await commentBtn.click();
        await delay(2000, 3000);

        // Find comment input
        const commentBox = await page.$('div[role="textbox"][contenteditable="true"], div[aria-label*="Viết bình luận"], div[aria-label*="Write a comment"]');
        
        if (commentBox) {
          await commentBox.click();
          await delay(500, 1000);

          // Upload image first
          const imgPath = getRandomImage();
          if (imgPath) {
            try {
              // Try to find file input for image
              const fileInput = await post.$('input[type="file"]') || await page.$('input[type="file"][accept*="image"]');
              if (fileInput) {
                await fileInput.setInputFiles(imgPath);
                console.log(`  📷 Attached image: ${path.basename(imgPath)}`);
                await delay(2000, 4000);
              }
            } catch (e) {
              console.log(`  ⚠️ Image upload failed: ${e}`);
            }
          }

          // Type comment + hashtag
          const comment = pickRandom(COMMENTS) + "\n" + pickRandom(HASHTAGS);
          await humanType(page, comment);
          await delay(1000, 2000);

          // Submit
          await page.keyboard.press("Enter");
          commentsDone++;
          console.log(`  💬 Comment ${commentsDone}/${commentCount}: ${comment.substring(0, 40)}...`);
          await delay(3000, 6000);

          // Try to reply to existing comments (random)
          if (Math.random() < 0.5) {
            try {
              const existingComments = await page.$$('div[role="article"] div[role="button"]:has-text("Phản hồi"), div[role="article"] div[role="button"]:has-text("Reply")');
              if (existingComments.length > 0) {
                const replyBtn = pickRandom(existingComments);
                await replyBtn.scrollIntoViewIfNeeded();
                await replyBtn.click();
                await delay(1500, 2500);

                const replyBox = await page.$('div[role="textbox"][contenteditable="true"]');
                if (replyBox) {
                  await replyBox.click();
                  await delay(500, 1000);
                  
                  const reply = pickRandom(REPLY_TEMPLATES) + " " + pickRandom(HASHTAGS);
                  await humanType(page, reply);
                  await page.keyboard.press("Enter");
                  repliesDone++;
                  console.log(`  ↩️ Reply ${repliesDone}: ${reply.substring(0, 40)}...`);
                  await delay(2000, 4000);
                }
              }
            } catch (e) {
              console.log(`  ⚠️ Reply error: ${e}`);
            }
          }

          // Anti-detection pause between comments
          await delay(5000, 15000);
        }
      } else {
        console.log(`  ⏭️ Post ${i + 1}: no comment button found`);
      }
    } catch (e) {
      console.log(`  ⚠️ Post ${i + 1} error: ${e}`);
    }

    // Scroll more to load new posts if needed
    if (i % 3 === 2) {
      await humanScroll(page, 800);
      await delay(2000, 4000);
    }
  }

  // If we haven't hit target, scroll more and try older posts
  if (commentsDone < commentCount) {
    console.log(`  📜 Need more posts, scrolling for older content...`);
    for (let extra = 0; extra < 5 && commentsDone < commentCount; extra++) {
      await humanScroll(page, 1000);
      await delay(3000, 5000);
      
      const morePosts = await page.$$('div[role="article"]');
      console.log(`  Found ${morePosts.length} total posts after scroll`);
    }
  }

  const resultSS = `mega-result-${targetPage.name.replace(/\s/g, '_')}.png`;
  await page.screenshot({ path: path.join(LOG_DIR, resultSS) });
  screenshots.push(resultSS);

  return {
    pageName: targetPage.name,
    comments: commentsDone,
    replies: repliesDone,
    screenshots,
  };
}

// ─── PHASE 4: SAVE REPORT ────────────────────────────────
function saveReport(report: any) {
  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
  console.log(`\n📊 Report saved to ${REPORT_FILE}`);
}

// ─── MAIN ────────────────────────────────────────────────
async function main() {
  console.log("🦊 ═══════════════════════════════════════════");
  console.log("🦊 TIỂU TÂM MEGA MISSION — START!");
  console.log("🦊 ═══════════════════════════════════════════\n");

  const startTime = Date.now();

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
    timezoneId: "Asia/Ho_Chi_Minh",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const report: any = {
    startTime: new Date().toISOString(),
    phases: {},
  };

  try {
    // ═══ PHASE 1: LOGIN ═══
    console.log("═══ PHASE 1: LOGIN ═══");
    const page = await loginWithCookies(context);
    await page.screenshot({ path: path.join(LOG_DIR, "mega-home.png") });
    report.phases.login = { status: "OK" };

    // ═══ PHASE 2: INBOX ═══
    const inboxResult = await checkAndReplyInbox(page);
    report.phases.inbox = inboxResult;
    console.log(`\n📩 Inbox: checked ${inboxResult.checked}, replied ${inboxResult.replied}`);

    // ═══ PHASE 3: COMMENT 4 PAGES ═══
    console.log("\n═══ PHASE 3: COMMENT 4 TRANG ═══");
    report.phases.pages = [];

    for (const targetPage of TARGET_PAGES) {
      const result = await visitAndComment(page, targetPage, 13);
      report.phases.pages.push(result);
      
      console.log(`\n📊 ${result.pageName}: ${result.comments} comments, ${result.replies} replies`);
      
      // Human-like break between pages
      console.log(`  ⏸️ Nghỉ giữa các trang...`);
      await delay(10000, 20000);
    }

    // ═══ SAVE COOKIES ═══
    const newCookies = await context.cookies();
    fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
    // Also save to session.json
    const sessionPath = path.join(__dirname, "..", "data", "cookies", "session.json");
    fs.writeFileSync(sessionPath, JSON.stringify(newCookies, null, 2));
    console.log(`\n🍪 Cookies refreshed & saved to BOTH files`);

    report.endTime = new Date().toISOString();
    report.duration = `${Math.round((Date.now() - startTime) / 1000)}s`;
    report.status = "COMPLETE";

  } catch (e: any) {
    console.error(`\n❌ ERROR: ${e.message}`);
    report.error = e.message;
    report.status = "FAILED";
  } finally {
    saveReport(report);
    await browser.close();
    console.log("\n🔒 Browser closed");
  }

  // ═══ SUMMARY ═══
  console.log("\n🦊 ═══════════════════════════════════════════");
  console.log("🦊 BÁO CÁO TỔNG KẾT");
  console.log("🦊 ═══════════════════════════════════════════");
  if (report.phases.pages) {
    let totalComments = 0;
    let totalReplies = 0;
    for (const p of report.phases.pages) {
      console.log(`  📄 ${p.pageName}: ${p.comments} comments, ${p.replies} replies`);
      totalComments += p.comments;
      totalReplies += p.replies;
    }
    console.log(`\n  📊 TỔNG: ${totalComments} comments, ${totalReplies} replies`);
  }
  console.log(`  ⏱️ Thời gian: ${report.duration || 'N/A'}`);
  console.log(`  📦 Status: ${report.status}`);
  console.log("🦊 ═══════════════════════════════════════════");
}

main().catch(console.error);
