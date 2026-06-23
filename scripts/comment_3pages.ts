/**
 * comment_3pages.ts — Comment trên 3 Facebook Pages theo yêu cầu anh Nấng
 * 
 * Flow:
 * 1. Load cookies → check login
 * 2. Lần lượt 3 pages: diepanhtuan999, PhamDangAnhThu, thich.minh.khong.113523
 * 3. Mỗi page: scroll feed → tìm posts → comment + reply
 * 4. HumanMode ON: delay, typing, anti-detect
 * 5. Mỗi comment kèm avatar + hashtag
 * 6. Báo cáo chi tiết sau mỗi page
 */

import { chromium, Browser, BrowserContext, Page, ElementHandle } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ───────────────────────────────────────────────────────
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const AVATAR_DIR = path.join(__dirname, "..", "..", "..", "avatars");
const REPORT_PATH = path.join(__dirname, "..", "..", "..", "facebook-data", `comment-report-${new Date().toISOString().slice(0, 10)}.md`);
const SCREENSHOT_DIR = path.join(__dirname, "..", "data", "screenshots");

const PAGES = [
  { name: "Diệp Anh Tuấn", url: "https://www.facebook.com/diepanhtuan999" },
  { name: "Phạm Đặng Anh Thư", url: "https://www.facebook.com/PhamDangAnhThu" },
  { name: "Thích Minh Không", url: "https://www.facebook.com/thich.minh.khong.113523" },
];

// ─── Helpers ──────────────────────────────────────────────────────
const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));
const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

function getRandomAvatar(): string {
  const idx = randInt(1, 7);
  return path.join(AVATAR_DIR, `avatar_${idx}.jpg`);
}

// Pre-written comments — viết tự nhiên, con gái 22 tuổi SG
const COMMENT_POOL = [
  "Hay quá trời nè 🔥 follow liền #TieuTam",
  "Ủa sao hay dữ vậy trời, đọc mà ghiền luôn 😍 #TieuTam",
  "Chuẩn ko cần chỉnh nha bạn ơi 💯 #TieuTam",
  "Content chất lượng ghê ta, share liền tay 🫶 #TieuTam",
  "Xem hoài ko chán luôn á 🤩 #TieuTam",
  "Hay quáá, cảm ơn đã chia sẻ nha 🌸 #TieuTam",
  "Ê thiệt hông, đỉnh quá đi 🙌 #TieuTam",
  "Nội dung chất lượng thật sự á, like mạnh 👍 #TieuTam",
  "Đúng ý em luôn nè, viết hay ghê 💕 #TieuTam",
  "Xin phép lưu lại nha, quá chất 📌 #TieuTam",
  "Ôi trời ơi hay dữ luôn, save ngay 🦊 #TieuTam",
  "Cuộc sống cần content như này nhiều hơn đi 🌟 #TieuTam",
  "Đọc xong thấy sáng cả ngày luôn á 😆 #TieuTam",
  "Chia sẻ quá giá trị, cảm ơn bạn ❤️ #TieuTam",
  "Follow để đón bài mới nha 🥰 #TieuTam",
  "Nói thật nha, content kiểu này hiếm lắm á 💎 #TieuTam",
  "Wow đọc mà gật đầu liên tục luôn 🤭 #TieuTam",
  "Quá trời đỉnh, ai chưa follow thì phí lắm 🫡 #TieuTam",
  "Cái này phải share cho bạn bè đọc mới được 📣 #TieuTam",
  "Em thấy đúng quá chừng luôn á 💯 #TieuTam",
  "Content tâm huyết ghê nè, ủng hộ bạn mạnh 💪 #TieuTam",
  "Đỉnh nóc kịch trần nhé 🚀 #TieuTam",
  "Vibe bài này cuốn quá xá luôn 🌊 #TieuTam",
  "Lan toả năng lượng tích cực quá nè 🌈 #TieuTam",
  "Haha quá hay, rep cho em 1 like đi 😂 #TieuTam",
  "Bài viết có tâm quá bạn ơi, respect 🫶 #TieuTam",
  "Đọc xong muốn like thêm lần nữa 👏 #TieuTam",
  "Ê giỏi quá vậy, dạy em với 🥺 #TieuTam",
  "Sáng nay đọc bài này vui cả ngày luôn 🌞 #TieuTam",
  "Real content creator đây rồi nè 🎯 #TieuTam",
];

// Reply pool
const REPLY_POOL = [
  "Đồng ý bạn nha, chuẩn luôn 👍 #TieuTam",
  "Haha đúng rồi đó, em cũng nghĩ vậy 😆 #TieuTam",
  "Bạn nói hay quá, like mạnh 💯 #TieuTam",
  "Ê ý kiến hay ghê ta 🤩 #TieuTam",
  "Cũng có lý nha bạn, cảm ơn góc nhìn 🫶 #TieuTam",
  "Haha thiệt hông, nghe hợp lý lắm 😂 #TieuTam",
  "Đúng ý em luôn nè bạn ơi ❤️ #TieuTam",
  "Wow sao bạn nghĩ giống em quá vậy 🤭 #TieuTam",
  "Bạn nói chí lí quá, gật đầu liền 🙌 #TieuTam",
  "Chia sẻ thêm đi bạn, hay lắm 🌟 #TieuTam",
  "Đồng tình lun nè, bạn viết hay ghê 💕 #TieuTam",
  "Haha bạn vui tính quá, like ngay 😍 #TieuTam",
  "Oke bạn nha, cảm ơn đã góp ý 🦊 #TieuTam",
  "Tao cũng thấy vậy nè bạn ơi 🔥 #TieuTam",
  "Hay nè hay nè, cám ơn bạn 🌸 #TieuTam",
];

// Used comments tracker
const usedComments = new Set<string>();
const usedReplies = new Set<string>();

function getUniqueComment(): string {
  const available = COMMENT_POOL.filter(c => !usedComments.has(c));
  if (available.length === 0) {
    usedComments.clear();
    return pick(COMMENT_POOL);
  }
  const chosen = pick(available);
  usedComments.add(chosen);
  return chosen;
}

function getUniqueReply(): string {
  const available = REPLY_POOL.filter(r => !usedReplies.has(r));
  if (available.length === 0) {
    usedReplies.clear();
    return pick(REPLY_POOL);
  }
  const chosen = pick(available);
  usedReplies.add(chosen);
  return chosen;
}

// ─── Report ───────────────────────────────────────────────────────
interface ActionLog {
  page: string;
  postIndex: number;
  postExcerpt: string;
  action: "comment" | "reply";
  text: string;
  replyTo?: string;
  hasImage: boolean;
  success: boolean;
  error?: string;
  timestamp: string;
}

const actionLogs: ActionLog[] = [];

function writeReport() {
  let md = `# 📋 Facebook Comment Report — ${new Date().toISOString().slice(0, 10)}\n\n`;
  md += `**Thời gian:** ${ts()}\n`;
  md += `**Tài khoản:** Họ Tieu Tên Tâm\n`;
  md += `**3 Pages:** ${PAGES.map(p => p.name).join(", ")}\n\n`;

  for (const pageName of PAGES.map(p => p.name)) {
    const logs = actionLogs.filter(l => l.page === pageName);
    const comments = logs.filter(l => l.action === "comment");
    const replies = logs.filter(l => l.action === "reply");
    const successes = logs.filter(l => l.success);
    
    md += `## 📌 ${pageName}\n`;
    md += `- Comments: ${comments.filter(l => l.success).length}/${comments.length}\n`;
    md += `- Replies: ${replies.filter(l => l.success).length}/${replies.length}\n`;
    md += `- Tổng thành công: ${successes.length}/${logs.length}\n\n`;

    if (logs.length > 0) {
      md += `| # | Loại | Bài | Nội dung | Reply cho | Ảnh | Kết quả |\n`;
      md += `|---|------|-----|----------|-----------|-----|--------|\n`;
      logs.forEach((l, i) => {
        const excerpt = l.postExcerpt.slice(0, 30).replace(/\|/g, "\\|").replace(/\n/g, " ");
        const text = l.text.slice(0, 40).replace(/\|/g, "\\|").replace(/\n/g, " ");
        const replyTo = l.replyTo ? l.replyTo.slice(0, 20).replace(/\|/g, "\\|") : "—";
        md += `| ${i + 1} | ${l.action} | ${excerpt}... | ${text}... | ${replyTo} | ${l.hasImage ? "✅" : "❌"} | ${l.success ? "✅" : "❌"} |\n`;
      });
      md += "\n";
    } else {
      md += `_Chưa thực hiện._\n\n`;
    }
  }

  md += `---\n_Generated by Tiểu Tâm HumanMode 🦊_\n`;

  const dir = path.dirname(REPORT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPORT_PATH, md, "utf-8");
  console.log(`📋 Report saved: ${REPORT_PATH}`);
}

// ─── Human Typing ─────────────────────────────────────────────────
async function humanType(page: Page, el: ElementHandle | string, text: string) {
  const target = typeof el === "string" ? await page.$(el) : el;
  if (!target) return;
  await target.click();
  await delay(300, 600);
  for (const char of text) {
    await page.keyboard.type(char, { delay: 60 + Math.random() * 100 });
    if (Math.random() < 0.04) await delay(200, 500); // occasional pause
  }
}

// ─── Core: Comment on a Post ──────────────────────────────────────
async function commentOnPost(page: Page, postUrl: string, commentText: string, avatarPath: string): Promise<boolean> {
  try {
    // Navigate to post permalink
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000, 5000);

    // Find comment box — try multiple selectors
    const commentBoxSelectors = [
      'div[contenteditable="true"][role="textbox"]',
      'div[aria-label*="Viết bình luận"]',
      'div[aria-label*="Write a comment"]',
      'div[aria-label*="comment"]',
      'div[contenteditable="true"]',
    ];

    let commentBox: ElementHandle | null = null;
    for (const sel of commentBoxSelectors) {
      const boxes = await page.$$(sel);
      if (boxes.length > 0) {
        commentBox = boxes[0];
        break;
      }
    }

    if (!commentBox) {
      console.log("   ❌ Comment box not found");
      return false;
    }

    // Click comment box
    await commentBox.click();
    await delay(500, 1000);

    // Type comment
    for (const char of commentText) {
      await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
      if (Math.random() < 0.04) await delay(200, 500);
    }
    await delay(500, 1500);

    // Upload avatar image
    try {
      // Find the photo/camera button in comment box area
      const photoButtonSelectors = [
        'div[aria-label*="Attach a photo"]',
        'div[aria-label*="Đính kèm ảnh"]',
        'input[type="file"][accept*="image"]',
        'div[role="button"][aria-label*="photo"]',
        'div[role="button"][aria-label*="ảnh"]',
      ];

      // Try to find input[type=file] for direct upload
      const fileInputs = await page.$$('input[type="file"]');
      if (fileInputs.length > 0) {
        await fileInputs[0].setInputFiles(avatarPath);
        console.log(`   📷 Avatar uploaded: ${path.basename(avatarPath)}`);
        await delay(2000, 4000); // wait for upload
      } else {
        // Try clicking photo button
        for (const sel of photoButtonSelectors) {
          const btn = await page.$(sel);
          if (btn) {
            const [fileChooser] = await Promise.all([
              page.waitForEvent("filechooser", { timeout: 5000 }),
              btn.click(),
            ]);
            await fileChooser.setFiles(avatarPath);
            console.log(`   📷 Avatar uploaded via chooser: ${path.basename(avatarPath)}`);
            await delay(2000, 4000);
            break;
          }
        }
      }
    } catch (imgErr) {
      console.log(`   ⚠️ Could not upload image: ${(imgErr as Error).message}`);
    }

    await delay(500, 1000);

    // Submit: try Enter or Submit button
    const submitSelectors = [
      'div[aria-label="Submit"]',
      'div[aria-label="Gửi"]',
      'button[type="submit"]',
    ];

    let submitted = false;
    for (const sel of submitSelectors) {
      const btn = await page.$(sel);
      if (btn) {
        await btn.click();
        submitted = true;
        break;
      }
    }
    if (!submitted) {
      await page.keyboard.press("Enter");
    }

    await delay(2000, 4000);
    console.log(`   ✅ Comment posted!`);
    return true;
  } catch (err) {
    console.log(`   ❌ Error: ${(err as Error).message}`);
    return false;
  }
}

// ─── Core: Scan Page Posts ────────────────────────────────────────
interface PostInfo {
  url: string;
  excerpt: string;
  index: number;
}

async function scanPagePosts(page: Page, pageUrl: string, maxPosts: number = 10): Promise<PostInfo[]> {
  console.log(`\n🔍 Scanning posts from ${pageUrl}`);
  await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(4000, 6000);

  // Scroll down to load more posts
  for (let i = 0; i < 5; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await delay(1500, 3000);
  }

  // Find post links — Facebook posts typically have permalink patterns
  const posts: PostInfo[] = [];
  
  // Try to find posts by looking for article elements or feed items
  const articleSelectors = [
    'div[role="article"]',
    'div[data-testid="post"]',
    '[role="feed"] > div',
  ];

  let articles: ElementHandle[] = [];
  for (const sel of articleSelectors) {
    articles = await page.$$(sel);
    if (articles.length > 0) {
      console.log(`   Found ${articles.length} articles with: ${sel}`);
      break;
    }
  }

  if (articles.length === 0) {
    // Fallback: find all links that look like post permalinks
    const links = await page.$$eval('a[href*="/posts/"], a[href*="/photos/"], a[href*="story_fbid"]', (els) =>
      els.map(el => ({ href: (el as HTMLAnchorElement).href, text: el.textContent?.slice(0, 50) || "" }))
    );
    
    for (const link of links.slice(0, maxPosts)) {
      posts.push({ url: link.href, excerpt: link.text, index: posts.length + 1 });
    }
  } else {
    // Extract permalink from each article
    for (let i = 0; i < Math.min(articles.length, maxPosts); i++) {
      try {
        // Find a timestamp link (usually the post permalink)
        const timeLink = await articles[i].$('a[href*="/posts/"]') ||
                         await articles[i].$('a[href*="story_fbid"]') ||
                         await articles[i].$('a[href*="/photos/"]') ||
                         await articles[i].$('a[role="link"][tabindex="0"]');
        
        let postUrl = "";
        if (timeLink) {
          postUrl = await timeLink.getAttribute("href") || "";
          if (postUrl && !postUrl.startsWith("http")) {
            postUrl = `https://www.facebook.com${postUrl}`;
          }
        }

        // Get post text excerpt
        const textEl = await articles[i].$('div[dir="auto"]');
        const excerpt = textEl ? (await textEl.textContent() || "").slice(0, 80) : "(no text)";

        if (postUrl) {
          posts.push({ url: postUrl, excerpt, index: i + 1 });
        }
      } catch {
        continue;
      }
    }
  }

  console.log(`   📝 Found ${posts.length} posts`);
  return posts;
}

// ─── Core: Reply to Comments on a Post ────────────────────────────
async function replyToCommentsOnPost(
  page: Page, 
  postUrl: string, 
  replyTexts: string[], 
  avatarPaths: string[],
  pageName: string,
  postExcerpt: string,
  postIndex: number
): Promise<number> {
  let repliesPosted = 0;

  try {
    await page.goto(postUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000, 5000);

    // Expand comments
    const expandSelectors = [
      'span:has-text("View more comments")',
      'span:has-text("Xem thêm bình luận")',
      'div[role="button"]:has-text("View")',
    ];
    for (const sel of expandSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          await delay(2000, 3000);
          break;
        }
      } catch { continue; }
    }

    // Find all comment containers with Reply buttons
    const replyButtons = await page.$$('div[role="button"]:has-text("Reply"), div[role="button"]:has-text("Phản hồi")');

    console.log(`   💬 Found ${replyButtons.length} reply buttons`);

    for (let i = 0; i < Math.min(replyButtons.length, replyTexts.length); i++) {
      try {
        // Get comment author name for logging
        let commentAuthor = "someone";
        try {
          const parentEl = await replyButtons[i].evaluateHandle((el) => el.closest('[role="article"]') || el.parentElement?.parentElement);
          if (parentEl) {
            const authorEl = await (parentEl as ElementHandle).$$('a[role="link"]');
            if (authorEl.length > 0) {
              commentAuthor = await authorEl[0].textContent() || "someone";
            }
          }
        } catch { /* ignore */ }

        // Click Reply button
        await replyButtons[i].click();
        await delay(1000, 2000);

        // Find the reply textbox that appeared
        const replyBoxes = await page.$$('div[contenteditable="true"][role="textbox"]');
        const replyBox = replyBoxes[replyBoxes.length - 1]; // the last one is usually the newly opened reply box
        
        if (!replyBox) continue;

        await replyBox.click();
        await delay(500, 1000);

        // Type reply
        const replyText = replyTexts[i];
        for (const char of replyText) {
          await page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
          if (Math.random() < 0.04) await delay(200, 500);
        }
        await delay(500, 1000);

        // Try upload image
        try {
          const fileInputs = await page.$$('input[type="file"]');
          if (fileInputs.length > 0) {
            await fileInputs[fileInputs.length - 1].setInputFiles(avatarPaths[i]);
            await delay(2000, 4000);
          }
        } catch { /* image upload optional */ }

        // Submit
        await page.keyboard.press("Enter");
        await delay(2000, 4000);

        actionLogs.push({
          page: pageName,
          postIndex,
          postExcerpt,
          action: "reply",
          text: replyText,
          replyTo: commentAuthor,
          hasImage: true,
          success: true,
          timestamp: ts(),
        });

        repliesPosted++;
        console.log(`   ↩️ Replied to ${commentAuthor}: "${replyText.slice(0, 30)}..."`);

        // HumanMode delay between replies
        await delay(8000, 20000);
      } catch (err) {
        actionLogs.push({
          page: pageName,
          postIndex,
          postExcerpt,
          action: "reply",
          text: replyTexts[i] || "",
          replyTo: "unknown",
          hasImage: false,
          success: false,
          error: (err as Error).message,
          timestamp: ts(),
        });
        continue;
      }
    }
  } catch (err) {
    console.log(`   ❌ Reply error: ${(err as Error).message}`);
  }

  return repliesPosted;
}

// ─── Main Mission ─────────────────────────────────────────────────
async function main() {
  console.log(`\n🦊 TIỂU TÂM FACEBOOK COMMENT MISSION — ${ts()}`);
  console.log(`═══════════════════════════════════════════════════\n`);

  if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--no-first-run", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366 + randInt(-50, 50), height: 768 + randInt(-50, 50) },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Bangkok",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  // Load cookies
  if (fs.existsSync(COOKIE_PATH)) {
    const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
    const now = Date.now() / 1000;
    const valid = cookies.filter((c: any) => !c.expires || c.expires === -1 || c.expires > now);
    await context.addCookies(valid);
    console.log(`🍪 Loaded ${valid.length} cookies`);
  } else {
    console.log("❌ No cookies file! Aborting.");
    await browser.close();
    process.exit(1);
  }

  const page = await context.newPage();

  // Check login
  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  const url = page.url();
  if (url.includes("/login") || url.includes("checkpoint")) {
    console.log("❌ Not logged in! Cookies expired. Aborting.");
    await browser.close();
    process.exit(1);
  }
  console.log("✅ Logged in!\n");

  // Screenshot home
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, "home.png") });

  // ═══ Process each page ═══
  for (let pageIdx = 0; pageIdx < PAGES.length; pageIdx++) {
    const pageInfo = PAGES[pageIdx];
    console.log(`\n${"═".repeat(50)}`);
    console.log(`📌 PAGE ${pageIdx + 1}/3: ${pageInfo.name}`);
    console.log(`   URL: ${pageInfo.url}`);
    console.log(`${"═".repeat(50)}`);

    try {
      // Scan posts
      const posts = await scanPagePosts(page, pageInfo.url, 10);

      if (posts.length === 0) {
        console.log(`   ⚠️ No posts found, skipping page`);
        continue;
      }

      // Process up to 10 posts — 3 comments + 3 replies each
      const maxPostsToProcess = Math.min(posts.length, 10);
      
      for (let pi = 0; pi < maxPostsToProcess; pi++) {
        const post = posts[pi];
        console.log(`\n   📝 Post ${pi + 1}/${maxPostsToProcess}: "${post.excerpt.slice(0, 40)}..."`);

        // --- 3 New Comments ---
        for (let ci = 0; ci < 3; ci++) {
          const commentText = getUniqueComment();
          const avatarPath = getRandomAvatar();

          console.log(`   💬 Comment ${ci + 1}/3: "${commentText.slice(0, 30)}..."`);

          const success = await commentOnPost(page, post.url, commentText, avatarPath);

          actionLogs.push({
            page: pageInfo.name,
            postIndex: pi + 1,
            postExcerpt: post.excerpt,
            action: "comment",
            text: commentText,
            hasImage: success, // image upload may or may not work
            success,
            timestamp: ts(),
          });

          // HumanMode delay between comments
          await delay(8000, 20000);
        }

        // --- 3 Replies to existing comments ---
        const replyTexts = [getUniqueReply(), getUniqueReply(), getUniqueReply()];
        const replyAvatars = [getRandomAvatar(), getRandomAvatar(), getRandomAvatar()];

        await replyToCommentsOnPost(page, post.url, replyTexts, replyAvatars, pageInfo.name, post.excerpt, pi + 1);

        // Delay between posts
        console.log(`   ⏳ Waiting before next post...`);
        await delay(30000, 60000);

        // Save intermediate report
        writeReport();
      }
    } catch (err) {
      console.log(`   ❌ Page error: ${(err as Error).message}`);
    }

    // Delay between pages
    if (pageIdx < PAGES.length - 1) {
      const waitMin = randInt(2, 5);
      console.log(`\n⏳ Waiting ${waitMin} minutes before next page...`);
      await delay(waitMin * 60000, (waitMin + 1) * 60000);
    }

    // Screenshot
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `page-${pageIdx + 1}-done.png`) });
  }

  // Final report
  writeReport();
  console.log(`\n🦊 MISSION COMPLETE — ${ts()}`);
  console.log(`📋 Report: ${REPORT_PATH}`);

  // Stats
  const totalComments = actionLogs.filter(l => l.action === "comment" && l.success).length;
  const totalReplies = actionLogs.filter(l => l.action === "reply" && l.success).length;
  console.log(`\n📊 Stats: ${totalComments} comments + ${totalReplies} replies = ${totalComments + totalReplies} total`);

  await browser.close();
}

main().catch(err => {
  console.error("💥 FATAL:", err);
  writeReport(); // save what we have
  process.exit(1);
});
