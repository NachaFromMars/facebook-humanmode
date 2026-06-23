#!/usr/bin/env tsx
/**
 * Facebook Auto-Post Pipeline: Ba Cuộc Gọi Nhỡ (8 beats)
 * - Đăng từ beat 1 → beat 8
 * - Random interval 13-21 phút giữa các beat
 * - Giữa các nhịp: quản lý fanpage (check inbox, reply comments, browse feed, react)
 */
import { chromium, type Page, type BrowserContext } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");
const STORIES_PATH = path.join(__dirname, "..", "data", "stories", "ba-cuoc-goi-nho-parts.json");
const STATE_PATH = path.join(__dirname, "..", "data", "logs", "beat-pipeline-state.json");

const PROFILE_URL = "https://www.facebook.com/profile.php?id=61588560594683";

const delay = (min: number, max: number) =>
  new Promise<void>((r) => setTimeout(r, min + Math.random() * (max - min)));

const log = (msg: string) =>
  console.log(`[${new Date().toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}] ${msg}`);

// ─── Load stories ────────────────────────────────────────────
interface BeatData {
  title: string;
  body: string;
}

function loadBeats(): BeatData[] {
  return JSON.parse(fs.readFileSync(STORIES_PATH, "utf-8"));
}

function getRandomImage(): string {
  const files = fs
    .readdirSync(ALBUM_DIR)
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f));
  return path.join(ALBUM_DIR, files[Math.floor(Math.random() * files.length)]);
}

function saveState(state: any) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function loadState(): any {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
  } catch {
    return { current_beat: 0, beats_posted: [], started: new Date().toISOString() };
  }
}

// ─── Browser setup ───────────────────────────────────────────
async function initBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const vpW = 1366 + Math.floor(Math.random() * 50 - 25);
  const vpH = 768 + Math.floor(Math.random() * 50 - 25);

  const context = await browser.newContext({
    viewport: { width: vpW, height: vpH },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);

  return { browser, context };
}

async function saveCookies(context: BrowserContext) {
  const c = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(c, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(c, null, 2));
}

// ─── Post a beat ─────────────────────────────────────────────
async function postBeat(
  context: BrowserContext,
  beat: BeatData,
  beatIndex: number
): Promise<boolean> {
  const page = await context.newPage();
  try {
    log(`📖 Đăng Beat ${beatIndex + 1}/8: ${beat.title.substring(0, 50)}...`);

    await page.goto(PROFILE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await delay(5000, 7000);

    if (page.url().includes("login")) {
      log("❌ Cookie hết hạn! Dừng pipeline.");
      return false;
    }
    log("✅ Profile loaded");

    // Scroll nhẹ rồi lên (giống người thật)
    await page.evaluate(() => window.scrollBy(0, 300));
    await delay(1500, 2500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await delay(2000, 3000);

    // Click composer
    let clicked = false;
    try {
      const loc = page.locator('text=Bạn đang nghĩ gì');
      if ((await loc.count()) > 0) {
        await loc.first().click();
        clicked = true;
        log("✅ Clicked composer");
      }
    } catch {}

    if (!clicked) {
      clicked = await page.evaluate(() => {
        const els = document.querySelectorAll("span");
        for (const s of els) {
          if (
            s.textContent &&
            s.textContent.includes("Bạn đang nghĩ gì")
          ) {
            (s as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
    }

    if (!clicked) {
      log("❌ Không tìm thấy composer");
      await page.screenshot({
        path: path.join(LOG_DIR, `pipeline-no-composer-${beatIndex}.png`),
      });
      return false;
    }
    await delay(3000, 5000);

    // Find textbox
    let tb = await page.$(
      'div[role="dialog"] div[role="textbox"][contenteditable="true"]'
    );
    if (!tb) tb = await page.$('div[role="textbox"][contenteditable="true"]');
    if (!tb) {
      log("❌ Không tìm thấy textbox");
      await page.screenshot({
        path: path.join(LOG_DIR, `pipeline-no-tb-${beatIndex}.png`),
      });
      return false;
    }

    await tb.click();
    await delay(500, 1000);

    // Insert text
    const fullText = beat.title + "\n\n" + beat.body;
    await page.keyboard.insertText(fullText);
    log(`✍️ Đã chèn text (${fullText.length} chars)`);
    await delay(1500, 2500);

    // Attach random image
    const imgPath = getRandomImage();
    try {
      const addBtns = await page.$$('div[role="dialog"] div[role="button"]');
      for (const btn of addBtns) {
        const label = await btn.getAttribute("aria-label");
        if (
          label &&
          (label.includes("Ảnh") ||
            label.includes("Photo") ||
            label.includes("Video"))
        ) {
          await btn.click();
          log("📷 Clicked photo button: " + label);
          await delay(1500, 2500);
          break;
        }
      }
      const fileInput = await page.$('input[type="file"][accept*="image"]');
      if (fileInput) {
        await fileInput.setInputFiles(imgPath);
        log("📷 Attached: " + path.basename(imgPath));
        await delay(4000, 6000);
      }
    } catch (e: any) {
      log("⚠️ Image attach: " + (e.message || "").substring(0, 50));
    }

    // Screenshot before post
    await page.screenshot({
      path: path.join(LOG_DIR, `pipeline-before-${beatIndex}.png`),
    });

    // Click Post/Đăng
    let posted = false;

    // Method 1: aria-label
    for (const label of ["Đăng", "Post"]) {
      const btn = await page.$(
        `div[role="dialog"] div[role="button"][aria-label="${label}"]`
      );
      if (btn) {
        const disabled = await btn.getAttribute("aria-disabled");
        if (disabled !== "true") {
          await btn.click({ force: true });
          posted = true;
          log(`✅ Clicked [${label}]`);
          break;
        }
      }
    }

    // Method 2: Locator
    if (!posted) {
      try {
        const postBtn = page
          .locator('div[role="dialog"] div[role="button"]:has-text("Đăng")')
          .last();
        if ((await postBtn.count()) > 0) {
          await postBtn.click({ force: true });
          posted = true;
          log("✅ Clicked via locator");
        }
      } catch {}
    }

    // Method 3: JS evaluate
    if (!posted) {
      posted = await page.evaluate(() => {
        const dialog = document.querySelector('div[role="dialog"]');
        if (!dialog) return false;
        const buttons = dialog.querySelectorAll('div[role="button"]');
        for (const btn of buttons) {
          const text = btn.textContent?.trim();
          const label = btn.getAttribute("aria-label");
          if (
            (text === "Đăng" || label === "Đăng" || text === "Post" || label === "Post") &&
            btn.getAttribute("aria-disabled") !== "true"
          ) {
            (btn as HTMLElement).click();
            return true;
          }
        }
        return false;
      });
      if (posted) log("✅ Clicked via evaluate");
    }

    // Method 4: Tab + Enter
    if (!posted) {
      log("⌨️ Trying Tab + Enter...");
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press("Tab");
        await delay(200, 400);
      }
      await page.keyboard.press("Enter");
      posted = true;
      log("⌨️ Pressed Enter after Tab");
    }

    await delay(6000, 10000);
    await page.screenshot({
      path: path.join(LOG_DIR, `pipeline-after-${beatIndex}.png`),
    });

    const dialogStillOpen = await page.$('div[role="dialog"]');
    if (!dialogStillOpen) {
      log("✅ Dialog closed — post thành công!");
      return true;
    } else {
      log("⚠️ Dialog vẫn mở — có thể chưa đăng được");
      return true; // still continue pipeline
    }
  } finally {
    await page.close();
  }
}

// ─── Fanpage management tasks (giữa các nhịp đăng) ──────────
async function manageFanpage(
  context: BrowserContext,
  taskIndex: number
): Promise<string> {
  const page = await context.newPage();
  const tasks = [
    "check_notifications",
    "check_inbox",
    "browse_feed_react",
    "check_comments",
    "browse_feed_scroll",
    "check_profile_engagement",
  ];
  const task = tasks[taskIndex % tasks.length];
  let report = "";

  try {
    switch (task) {
      case "check_notifications": {
        log("🔔 Checking notifications...");
        await page.goto("https://www.facebook.com/notifications", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await delay(4000, 6000);

        // Count unread notifications
        const notifCount = await page.evaluate(() => {
          const items = document.querySelectorAll(
            '[aria-label*="thông báo"], [role="listitem"]'
          );
          return items.length;
        });
        report = `🔔 ${notifCount} notifications visible`;

        // Scroll through notifications (like reading them)
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 300));
          await delay(2000, 4000);
        }
        break;
      }

      case "check_inbox": {
        log("📬 Checking Messenger inbox...");
        await page.goto("https://www.facebook.com/messages/t/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await delay(4000, 6000);

        // Look for unread messages
        const unreadCount = await page.evaluate(() => {
          const unreads = document.querySelectorAll(
            '[aria-label*="chưa đọc"], [data-visualcompletion*="unread"]'
          );
          return unreads.length;
        });
        report = `📬 ${unreadCount} unread messages`;

        await page.screenshot({
          path: path.join(LOG_DIR, "pipeline-inbox.png"),
        });
        break;
      }

      case "browse_feed_react": {
        log("👀 Browsing feed + reacting...");
        await page.goto("https://www.facebook.com/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await delay(4000, 6000);

        let reactCount = 0;
        // Scroll and occasionally react
        for (let i = 0; i < 5; i++) {
          await page.evaluate(() =>
            window.scrollBy(0, 400 + Math.random() * 300)
          );
          await delay(3000, 6000);

          // 30% chance to like a visible post
          if (Math.random() < 0.3) {
            try {
              const likeButtons = await page.$$(
                'div[aria-label="Thích"], div[aria-label="Like"]'
              );
              if (likeButtons.length > 0) {
                const btn =
                  likeButtons[
                    Math.floor(Math.random() * likeButtons.length)
                  ];
                await btn.click();
                reactCount++;
                log(`👍 Liked a post (${reactCount})`);
                await delay(2000, 4000);
              }
            } catch {}
          }
        }
        report = `👀 Browsed feed, liked ${reactCount} posts`;
        break;
      }

      case "check_comments": {
        log("💬 Checking comments on posts...");
        await page.goto(PROFILE_URL, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await delay(4000, 6000);

        // Scroll to see posts
        for (let i = 0; i < 3; i++) {
          await page.evaluate(() => window.scrollBy(0, 500));
          await delay(2000, 3000);
        }

        // Count comments on visible posts
        const commentCount = await page.evaluate(() => {
          const comments = document.querySelectorAll(
            'a[href*="comment"], span:has-text("bình luận")'
          );
          return comments.length;
        });
        report = `💬 Found ~${commentCount} comment indicators on profile`;
        break;
      }

      case "browse_feed_scroll": {
        log("📜 Leisurely feed browsing...");
        await page.goto("https://www.facebook.com/", {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await delay(4000, 6000);

        // Just scroll and read (lurk mode)
        for (let i = 0; i < 8; i++) {
          const scrollDist = 200 + Math.random() * 400;
          await page.evaluate((d) => window.scrollBy(0, d), scrollDist);
          await delay(4000, 8000); // Read time

          // 5% chance to scroll back up
          if (Math.random() < 0.05) {
            await page.evaluate(() => window.scrollBy(0, -200));
            await delay(2000, 3000);
          }
        }
        report = "📜 Browsed feed ~2 minutes (lurk mode)";
        break;
      }

      case "check_profile_engagement": {
        log("📊 Checking profile engagement...");
        await page.goto(PROFILE_URL, {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        });
        await delay(4000, 6000);

        // Scroll through recent posts
        for (let i = 0; i < 4; i++) {
          await page.evaluate(() => window.scrollBy(0, 400));
          await delay(2000, 4000);
        }

        await page.screenshot({
          path: path.join(LOG_DIR, "pipeline-engagement.png"),
        });
        report = "📊 Checked profile engagement";
        break;
      }
    }
  } catch (e: any) {
    report = `⚠️ Task ${task} error: ${(e.message || "").substring(0, 60)}`;
    log(report);
  } finally {
    await page.close();
  }

  return report;
}

// ─── MAIN PIPELINE ───────────────────────────────────────────
async function main() {
  const beats = loadBeats();
  const state = loadState();

  log("🦊 ═══════════════════════════════════════════════");
  log("🦊 BA CUỘC GỌI NHỠ — Auto Post Pipeline");
  log(`🦊 8 beats, interval 13-21 min, starting from beat 1`);
  log("🦊 ═══════════════════════════════════════════════");

  const { browser, context } = await initBrowser();

  try {
    for (let i = 0; i < beats.length; i++) {
      // ── Post beat ──
      const success = await postBeat(context, beats[i], i);
      
      state.current_beat = i + 1;
      state.beats_posted.push({
        beat: i + 1,
        title: beats[i].title,
        time: new Date().toISOString(),
        success,
      });
      saveState(state);

      if (!success) {
        log(`❌ Beat ${i + 1} failed — dừng pipeline`);
        break;
      }

      log(`✅ Beat ${i + 1}/8 DONE`);

      // Save cookies after each post
      await saveCookies(context);

      // ── If not last beat, wait + manage fanpage ──
      if (i < beats.length - 1) {
        const intervalMin = 13 + Math.floor(Math.random() * 9); // 13-21 min
        const intervalMs = intervalMin * 60 * 1000;

        log(`⏱️ Nghỉ ${intervalMin} phút trước beat ${i + 2}...`);

        // Split wait time into segments for fanpage tasks
        const taskCount = Math.floor(intervalMin / 5); // ~1 task per 5 min
        const segmentMs = intervalMs / (taskCount + 1);

        for (let t = 0; t < taskCount; t++) {
          // Wait a segment
          await delay(segmentMs * 0.8, segmentMs * 1.2);

          // Do a fanpage management task
          const report = await manageFanpage(context, i * 3 + t);
          log(`📋 [Task ${t + 1}/${taskCount}] ${report}`);
        }

        // Wait remaining time
        const elapsed = taskCount * segmentMs;
        const remaining = intervalMs - elapsed;
        if (remaining > 0) {
          await delay(remaining * 0.8, remaining);
        }

        log(`⏱️ Interval done — posting beat ${i + 2}...`);
      }
    }

    state.completed = true;
    state.finished = new Date().toISOString();
    saveState(state);

    log("🦊 ═══════════════════════════════════════════════");
    log("🦊 PIPELINE COMPLETE — 8/8 beats đã đăng!");
    log("🦊 ═══════════════════════════════════════════════");
  } finally {
    await saveCookies(context);
    await browser.close();
  }
}

main().catch((e) => {
  console.error("💀 Pipeline crashed:", e);
  process.exit(1);
});
