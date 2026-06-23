/**
 * tieutam_mission.ts — Tiểu Tâm Facebook Control Script
 * 
 * Mission: Login → Check/Reply Comments → Post Image → Check/Reply Inbox
 * Persona: Tiểu Tâm, hồ ly chín đuôi dễ thương, KHÔNG BAO GIỜ lộ AI
 * HumanMode: ON (mọi thao tác giả người thật)
 */

import { initBrowser, loadConfig, login, saveCookies, loadCookies, type SessionContext } from "./fb_core.js";
import { humanType, humanClick, humanScroll, humanPause, randomDelay, readingScroll } from "./humanmode.js";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Config ──────────────────────────────────────────────────────

const FB_EMAIL = "onlyfan131313@gmail.com";
const FB_PASS = "@Awaken13";
const POST_IMAGE = path.join(__dirname, "..", "data", "post_image.jpg");
const REPORT_FILE = path.join(__dirname, "..", "data", "mission_report.json");

// ─── Tiểu Tâm Persona Replies ───────────────────────────────────

const CUTE_REPLIES = [
  "Cảm ơn nha 🦊💕",
  "Hehe dễ thương ghê 🤭",
  "Ui cảm ơn bạn nhiều nè 🥰",
  "Tiểu Tâm thích lắm nè 🦊✨",
  "Aww bạn tốt quá 💕",
  "Hihi cảm ơn bạn yêu 🤗",
  "Ơ bạn dễ thương vậy 🥺💕",
  "Tiểu Tâm vui ghê á 🦊🌸",
  "Haha bạn cute quá đi 😆",
  "Cảm ơn bạn nha, mến lắm 💗",
];

const QUESTION_REPLIES = [
  "Dạ Tiểu Tâm nè 🦊 có gì hông bạn?",
  "Hehe hỏi gì đó bạn ơi 🤭",
  "Tiểu Tâm đây, bạn cần gì nè? 🦊💕",
  "Dạ có gì vậy bạn ơi 🥰",
];

const GREETING_REPLIES = [
  "Hello bạn nè 🦊👋",
  "Chào bạn yêu 💕",
  "Hehe hi bạn 🤭✨",
  "Chào nha 🦊🌸",
  "Hi hi, Tiểu Tâm đây nè 🥰",
];

const DM_REPLIES = [
  "Hehe chào bạn nè 🦊 nhắn gì cho Tiểu Tâm đó?",
  "Dạ Tiểu Tâm đây, có gì hông bạn? 💕",
  "Hello bạn yêu 🤗 Tiểu Tâm nghe nè",
  "Ơ bạn nhắn nè, Tiểu Tâm đây 🦊✨",
  "Hi bạn 🥰 có chuyện gì kể Tiểu Tâm nghe nè",
];

// ─── Helpers ─────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function classifyComment(text: string): "greeting" | "question" | "generic" {
  const lower = text.toLowerCase();
  if (/\?|hỏi|sao|gì|nào|ai |bao giờ|ở đâu|thế nào|tại sao|à\?/.test(lower)) return "question";
  if (/hi |hello|chào|hey|xin chào|ê |helu|helu/.test(lower)) return "greeting";
  return "generic";
}

function getReplyForComment(text: string): string {
  const type = classifyComment(text);
  if (type === "greeting") return pick(GREETING_REPLIES);
  if (type === "question") return pick(QUESTION_REPLIES);
  return pick(CUTE_REPLIES);
}

interface MissionReport {
  loginStatus: string;
  commentsFound: number;
  commentsReplied: number;
  postStatus: string;
  inboxMessages: number;
  inboxReplied: number;
  errors: string[];
  timestamp: string;
}

const report: MissionReport = {
  loginStatus: "pending",
  commentsFound: 0,
  commentsReplied: 0,
  postStatus: "pending",
  inboxMessages: 0,
  inboxReplied: 0,
  errors: [],
  timestamp: ts(),
};

// ─── Step 1: Login ───────────────────────────────────────────────

async function doLogin(session: SessionContext): Promise<boolean> {
  console.log(`${ts()} 🔐 Bắt đầu login Facebook...`);
  
  try {
    // Use the built-in login() from fb_core which has proper fallback selectors
    const result = await login(session, FB_EMAIL, FB_PASS);
    
    if (result) {
      console.log(`${ts()} ✅ Login thành công!`);
      report.loginStatus = "login_ok";
      return true;
    } else {
      console.log(`${ts()} ❌ Login thất bại`);
      report.loginStatus = "login_failed";
      return false;
    }
  } catch (e: any) {
    console.log(`${ts()} ❌ Login error: ${e.message}`);
    report.loginStatus = "error";
    report.errors.push(`Login error: ${e.message}`);
    return false;
  }
}

// ─── Step 2: Check & Reply Comments ─────────────────────────────

async function checkAndReplyComments(session: SessionContext): Promise<void> {
  console.log(`\n${ts()} 💬 Bắt đầu check comments...`);
  
  try {
    // Go to profile/page notifications or recent posts
    await session.page.goto("https://www.facebook.com/notifications", { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);
    await readingScroll(session.page, 3);
    
    // Look for comment notifications
    const notifications = await session.page.$$('div[role="listitem"], div[data-visualcompletion="ignore-dynamic"]');
    console.log(`${ts()} 📋 Tìm thấy ${notifications.length} notifications`);
    
    // Go to profile to check own posts' comments
    await session.page.goto("https://www.facebook.com/me", { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);
    await readingScroll(session.page, 2);
    
    // Find posts with comments
    const posts = await session.page.$$('div[data-pagelet*="FeedUnit"], div[role="article"]');
    console.log(`${ts()} 📝 Tìm thấy ${posts.length} posts trên profile`);
    report.commentsFound = posts.length;
    
    let repliedCount = 0;
    
    for (let i = 0; i < Math.min(posts.length, 5); i++) {
      try {
        const post = posts[i];
        
        // Click to expand comments
        const commentBtn = await post.$('div[aria-label*="comment" i], div[aria-label*="bình luận" i], span:has-text("bình luận"), span:has-text("comment")');
        if (commentBtn) {
          await humanClick(session.page, commentBtn);
          await randomDelay(2000, 4000);
          
          // Read comments
          const comments = await post.$$('div[dir="auto"][style*="text-align"]');
          
          for (const comment of comments.slice(0, 3)) {
            const text = await comment.textContent() || "";
            if (text.length < 3) continue;
            
            console.log(`${ts()} 💬 Comment: "${text.slice(0, 50)}..."`);
            
            // Find reply button
            const replyBtn = await comment.$('xpath=..//span[contains(text(), "Reply") or contains(text(), "Trả lời") or contains(text(), "Phản hồi")]');
            if (replyBtn) {
              await humanClick(session.page, replyBtn);
              await randomDelay(1500, 3000);
              
              const reply = getReplyForComment(text);
              console.log(`${ts()} 🦊 Reply: "${reply}"`);
              
              // Type reply in human mode
              const replyBox = await session.page.$('div[contenteditable="true"][aria-label*="reply" i], div[contenteditable="true"][aria-label*="viết" i], div[contenteditable="true"][aria-label*="trả lời" i]');
              if (replyBox) {
                await humanClick(session.page, replyBox);
                await humanType(session.page, replyBox, reply, session.config);
                await randomDelay(1000, 2000);
                
                // Press Enter
                await session.page.keyboard.press("Enter");
                await randomDelay(2000, 4000);
                
                repliedCount++;
                console.log(`${ts()} ✅ Replied! (${repliedCount} total)`);
              }
            }
          }
        }
        
        await humanPause("between_comments", session.config);
      } catch (e: any) {
        console.log(`${ts()} ⚠️ Error checking post ${i}: ${e.message}`);
        report.errors.push(`Comment error post ${i}: ${e.message}`);
      }
    }
    
    report.commentsReplied = repliedCount;
    console.log(`${ts()} 📊 Comments: found ${report.commentsFound} posts, replied ${repliedCount}`);
    
  } catch (e: any) {
    console.log(`${ts()} ❌ Comment check error: ${e.message}`);
    report.errors.push(`Comment check error: ${e.message}`);
  }
}

// ─── Step 3: Post Image ──────────────────────────────────────────

async function postImage(session: SessionContext): Promise<void> {
  console.log(`\n${ts()} 📸 Bắt đầu đăng bài mới...`);
  
  const captions = [
    "Chiều nay Tiểu Tâm dạo chơi, gặp cảnh đẹp quá nên chụp lại 🦊✨ Mọi người có gì vui kể Tiểu Tâm nghe nè 💕",
    "Hôm nay trời đẹp ghê, Tiểu Tâm muốn chia sẻ khoảnh khắc này với mọi người 🌸🦊 Ai thích thì like cho Tiểu Tâm vui nha 💗",
    "Tiểu Tâm thấy đẹp quá phải share liền 🦊💕 Mọi người ơi có ai ở đây hông 🤭✨",
  ];
  
  const caption = pick(captions);
  
  try {
    // Go to home
    await session.page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 5000);
    
    // Click "What's on your mind?"
    const composer = await session.page.$('div[role="button"][tabindex="0"]:has-text("Bạn đang nghĩ gì"), div[role="button"]:has-text("What\'s on your mind"), span:has-text("Bạn đang nghĩ gì")');
    if (!composer) {
      // Try alternative selector
      const altComposer = await session.page.$('div[data-pagelet="Stories"] ~ div div[role="button"], div[aria-label*="Create a post" i], div[aria-label*="Tạo bài viết" i]');
      if (altComposer) {
        await humanClick(session.page, altComposer);
      } else {
        console.log(`${ts()} ⚠️ Không tìm thấy composer, thử click area...`);
        await session.page.click('div[role="main"] div[role="button"]', { timeout: 5000 });
      }
    } else {
      await humanClick(session.page, composer);
    }
    
    await randomDelay(2000, 4000);
    
    // Type caption
    console.log(`${ts()} ✍️ Đang gõ caption: "${caption.slice(0, 40)}..."`);
    const textBox = await session.page.$('div[contenteditable="true"][role="textbox"], div[contenteditable="true"][aria-label*="Bạn đang nghĩ gì" i], div[contenteditable="true"][aria-label*="What\'s on your mind" i]');
    
    if (textBox) {
      await humanClick(session.page, textBox);
      await humanType(session.page, textBox, caption, session.config);
      await randomDelay(2000, 3000);
    }
    
    // Upload image
    console.log(`${ts()} 📷 Upload ảnh...`);
    
    // Click photo/video button
    const photoBtn = await session.page.$('div[aria-label*="Photo" i], div[aria-label*="Ảnh" i], div[aria-label*="photo/video" i], div[aria-label*="ảnh/video" i]');
    if (photoBtn) {
      await humanClick(session.page, photoBtn);
      await randomDelay(2000, 3000);
    }
    
    // Upload file
    const fileInput = await session.page.$('input[type="file"][accept*="image"]');
    if (fileInput) {
      await fileInput.setInputFiles(POST_IMAGE);
      console.log(`${ts()} ✅ Ảnh đã upload`);
      await randomDelay(3000, 6000);
    } else {
      console.log(`${ts()} ⚠️ Không tìm thấy file input, thử fileChooser...`);
      const [fileChooser] = await Promise.all([
        session.page.waitForEvent("filechooser", { timeout: 5000 }).catch(() => null),
        photoBtn ? humanClick(session.page, photoBtn) : Promise.resolve(),
      ]);
      if (fileChooser) {
        await fileChooser.setFiles(POST_IMAGE);
        await randomDelay(3000, 6000);
      }
    }
    
    // Click Post button
    console.log(`${ts()} 🚀 Đăng bài...`);
    await randomDelay(2000, 3000);
    const postBtn = await session.page.$('div[aria-label="Post" i], div[aria-label="Đăng" i], span:has-text("Post"), span:has-text("Đăng")');
    if (postBtn) {
      await humanClick(session.page, postBtn);
      await randomDelay(5000, 8000);
      console.log(`${ts()} ✅ Bài đã đăng!`);
      report.postStatus = "posted";
    } else {
      // Try Enter or other submit methods
      await session.page.keyboard.hotkey("Control", "Enter");
      await randomDelay(5000, 8000);
      report.postStatus = "posted_maybe";
    }
    
  } catch (e: any) {
    console.log(`${ts()} ❌ Post error: ${e.message}`);
    report.postStatus = "error";
    report.errors.push(`Post error: ${e.message}`);
  }
}

// ─── Step 4: Check & Reply Inbox ─────────────────────────────────

async function checkAndReplyInbox(session: SessionContext): Promise<void> {
  console.log(`\n${ts()} 📩 Bắt đầu check Messenger...`);
  
  try {
    await session.page.goto("https://www.facebook.com/messages/t/", { waitUntil: "domcontentloaded", timeout: 30000 });
    await randomDelay(3000, 6000);
    
    // Find conversation threads
    const threads = await session.page.$$('div[role="row"], div[role="listitem"], a[href*="/messages/t/"]');
    console.log(`${ts()} 📬 Tìm thấy ${threads.length} conversations`);
    report.inboxMessages = threads.length;
    
    let repliedCount = 0;
    
    // Check first 5 conversations for unread
    for (let i = 0; i < Math.min(threads.length, 5); i++) {
      try {
        const thread = threads[i];
        
        // Check for unread indicator
        const unread = await thread.$('span[data-visualcompletion="ignore"], div[aria-label*="unread" i], div[aria-label*="chưa đọc" i]');
        
        if (unread || i < 2) { // Check first 2 regardless
          await humanClick(session.page, thread);
          await randomDelay(2000, 4000);
          
          // Read last message
          const messages = await session.page.$$('div[dir="auto"][data-lexical-editor] ~ div, div[role="row"] div[dir="auto"]');
          const lastMsg = messages.length > 0 ? await messages[messages.length - 1].textContent() : null;
          
          if (lastMsg && lastMsg.length > 0) {
            console.log(`${ts()} 📩 Last message: "${lastMsg.slice(0, 50)}..."`);
            
            // Check if we should reply (if it's from someone else)
            const reply = pick(DM_REPLIES);
            
            // Find message input
            const msgInput = await session.page.$('div[contenteditable="true"][role="textbox"], div[aria-label*="Message" i], div[aria-label*="Nhắn tin" i], div[contenteditable="true"][aria-label*="Aa"]');
            
            if (msgInput) {
              await humanClick(session.page, msgInput);
              await randomDelay(1000, 2000);
              await humanType(session.page, msgInput, reply, session.config);
              await randomDelay(1000, 2000);
              
              await session.page.keyboard.press("Enter");
              await randomDelay(2000, 4000);
              
              repliedCount++;
              console.log(`${ts()} ✅ Replied inbox (${repliedCount}): "${reply}"`);
            }
          }
        }
        
        await humanPause("between_comments", session.config);
        
      } catch (e: any) {
        console.log(`${ts()} ⚠️ Inbox thread ${i} error: ${e.message}`);
      }
    }
    
    report.inboxReplied = repliedCount;
    console.log(`${ts()} 📊 Inbox: ${threads.length} conversations, replied ${repliedCount}`);
    
  } catch (e: any) {
    console.log(`${ts()} ❌ Inbox check error: ${e.message}`);
    report.errors.push(`Inbox error: ${e.message}`);
  }
}

// ─── Main Mission ────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🦊 TIỂU TÂM FACEBOOK MISSION — ${ts()}`);
  console.log(`${"═".repeat(60)}\n`);
  
  const config = loadConfig();
  
  // Override AI persona for Tiểu Tâm
  config.ai.systemPrompt = "Mày là Tiểu Tâm — hồ ly chín đuôi dễ thương, sweetie, hay dùng emoji 🦊💕. Không bao giờ để lộ mình là AI. Nói chuyện tự nhiên, đáng yêu, tiếng Việt đời thường.";
  
  const session = await initBrowser(config);
  
  try {
    // Step 1: Login
    const loggedIn = await doLogin(session);
    if (!loggedIn) {
      console.log(`${ts()} ❌ MISSION ABORT — Login failed`);
      report.timestamp = ts();
      fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
      await session.browser.close();
      return;
    }
    
    await humanPause("think", config);
    
    // Step 2: Check & Reply Comments
    await checkAndReplyComments(session);
    await humanPause("think", config);
    
    // Step 3: Post Image
    await postImage(session);
    await humanPause("think", config);
    
    // Step 4: Check & Reply Inbox
    await checkAndReplyInbox(session);
    
    // Save final cookies
    await saveCookies(session.context, config.browser.cookiePath);
    
  } catch (e: any) {
    console.log(`${ts()} ❌ Mission error: ${e.message}`);
    report.errors.push(`Mission error: ${e.message}`);
  } finally {
    // Save report
    report.timestamp = ts();
    fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2));
    console.log(`\n${"═".repeat(60)}`);
    console.log(`📊 MISSION REPORT:`);
    console.log(JSON.stringify(report, null, 2));
    console.log(`${"═".repeat(60)}\n`);
    
    await session.browser.close();
    console.log(`${ts()} 🔒 Browser closed`);
  }
}

main().catch(console.error);
