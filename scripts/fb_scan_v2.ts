/**
 * fb_scan_v2.ts — Dry-run scan using click navigation instead of direct URLs.
 * Reports profile, notifications, page moderation queue.
 */

import { chromium, type Page } from "playwright";
import * as fs from "node:fs";

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

async function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

(async () => {
  console.log(`${ts()} 🔍 FACEBOOK DRY-RUN SCAN V2`);
  console.log("=".repeat(60));

  const browser = await chromium.launch({ headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await ctx.newPage();

  // Load cookies
  const cookiePath = "./data/cookies/session.json";
  if (fs.existsSync(cookiePath)) {
    const cookies = JSON.parse(fs.readFileSync(cookiePath, "utf-8"));
    await ctx.addCookies(cookies);
    console.log(`${ts()} 🍪 Loaded ${cookies.length} cookies`);
  }

  // Go to Facebook home
  await page.goto("https://www.facebook.com/", { waitUntil: "domcontentloaded" });
  await delay(5000);

  const homeUrl = page.url();
  console.log(`${ts()} 📍 Home URL: ${homeUrl}`);

  if (homeUrl.includes("login")) {
    console.log(`${ts()} ❌ Not logged in — cookies expired`);
    await browser.close();
    process.exit(1);
  }

  // ─── 1. PROFILE INFO ──────────────────────────────────────────
  console.log(`\n${ts()} 📋 PROFILE INFO`);

  const profile = await page.evaluate(() => {
    // Try multiple ways to get profile name
    // Method 1: navigation profile link
    const profileLinks = document.querySelectorAll('a[href]');
    let name = "Unknown";
    let profileUrl = "";

    for (const link of profileLinks) {
      const href = (link as HTMLAnchorElement).href;
      const ariaLabel = link.getAttribute("aria-label") || "";
      
      if (ariaLabel.toLowerCase().includes("profile") || ariaLabel.toLowerCase().includes("trang cá nhân")) {
        name = ariaLabel;
        profileUrl = href;
        break;
      }
    }

    // Method 2: account settings area 
    if (name === "Unknown") {
      const userNav = document.querySelector('div[role="navigation"] a[role="link"]');
      if (userNav) {
        name = userNav.textContent?.trim() || "Unknown";
        profileUrl = (userNav as HTMLAnchorElement).href || "";
      }
    }

    return { name, url: profileUrl };
  });

  console.log(`  Name: ${profile.name}`);
  console.log(`  URL: ${profile.url}`);

  // Take screenshot of home page
  await page.screenshot({ path: "./data/logs/home.png" });
  console.log(`${ts()} 📸 Home screenshot saved`);

  // ─── 2. NOTIFICATIONS ─────────────────────────────────────────
  console.log(`\n${ts()} 🔔 NOTIFICATIONS`);

  // Click notification bell instead of navigating directly
  const bellClicked = await page.evaluate(() => {
    const bells = document.querySelectorAll('a[href="/notifications"], a[aria-label*="Notification" i], a[aria-label*="Thông báo" i], div[aria-label*="Notification" i], div[aria-label*="Thông báo" i]');
    for (const bell of bells) {
      (bell as HTMLElement).click();
      return true;
    }
    return false;
  });

  if (bellClicked) {
    console.log(`${ts()} 🔔 Clicked notification bell`);
    await delay(3000);
  } else {
    console.log(`${ts()} ⚠️ Bell not found, trying URL...`);
    await page.goto("https://www.facebook.com/notifications", { waitUntil: "domcontentloaded" });
    await delay(4000);
  }

  // Screenshot notifications
  await page.screenshot({ path: "./data/logs/notifications.png" });

  const notifications = await page.evaluate(() => {
    const results: Array<{ text: string; type: string }> = [];
    
    // Grab all visible text blocks that look like notifications
    const allElements = document.querySelectorAll('div[role="listitem"], div[role="row"], a[href*="notif"], div[class] span');
    const seen = new Set<string>();
    
    for (const el of allElements) {
      const text = el.textContent?.trim() || "";
      // Filter: reasonable notification length, not duplicate
      if (text.length > 15 && text.length < 500 && !seen.has(text)) {
        // Check it's not a UI element
        const lower = text.toLowerCase();
        if (!lower.startsWith("facebook") && !lower.startsWith("search") && !lower.startsWith("home")) {
          seen.add(text);
          results.push({ text, type: "notification" });
        }
      }
    }
    
    return results.slice(0, 15);
  });

  console.log(`  Found: ${notifications.length} notifications`);
  for (let i = 0; i < notifications.length; i++) {
    console.log(`  ${i + 1}. ${notifications[i].text.slice(0, 150)}`);
  }

  // ─── 3. PAGES ──────────────────────────────────────────────────
  console.log(`\n${ts()} 📄 YOUR PAGES`);

  // Navigate to pages via menu
  await page.goto("https://www.facebook.com/pages/?category=your_pages", { waitUntil: "domcontentloaded" });
  await delay(4000);

  await page.screenshot({ path: "./data/logs/pages.png" });

  const pageInfo = await page.evaluate(() => {
    const results: Array<{ name: string; url: string }> = [];
    const links = document.querySelectorAll('a[href]');
    const seen = new Set<string>();

    for (const link of links) {
      const href = (link as HTMLAnchorElement).href;
      const text = link.textContent?.trim() || "";
      
      // Filter for page-like links (not utility links)
      if (text.length > 2 && text.length < 80 &&
          !text.includes("Create") && !text.includes("Tạo") &&
          !text.includes("Meta AI") && !text.includes("Log") &&
          !seen.has(text) &&
          href.includes("facebook.com/")) {
        seen.add(text);
        results.push({ name: text, url: href });
      }
    }

    return results.slice(0, 10);
  });

  console.log(`  Found: ${pageInfo.length} pages`);
  for (const p of pageInfo) {
    console.log(`  - ${p.name} → ${p.url}`);
  }

  // ─── 4. PAGE MODERATION (for each page) ───────────────────────
  console.log(`\n${ts()} 🔍 PAGE MODERATION QUEUE`);

  const moderationResults: Array<{
    page: string;
    content: string;
    author: string;
    recommendation: string;
    reason: string;
  }> = [];

  // Try each page's activity log / pending posts
  for (const p of pageInfo) {
    try {
      const slug = new URL(p.url).pathname.replace(/\/$/, "");
      
      // Try multiple moderation URLs
      const moderationUrls = [
        `https://www.facebook.com${slug}/pending_posts`,
        `https://www.facebook.com${slug}?sk=pending`,
        `https://www.facebook.com${slug}/settings/?tab=pending_posts`,
      ];

      for (const modUrl of moderationUrls) {
        await page.goto(modUrl, { waitUntil: "domcontentloaded" });
        await delay(3000);
        
        const currentUrl = page.url();
        if (!currentUrl.includes("login")) {
          console.log(`  📄 Checking: ${p.name} → ${currentUrl}`);
          await page.screenshot({ path: `./data/logs/mod_${p.name.replace(/[^a-zA-Z0-9]/g, '_')}.png` });
          
          const posts = await page.evaluate(() => {
            const items: Array<{ content: string; author: string }> = [];
            const articles = document.querySelectorAll('div[role="article"], div[data-pagelet]');
            for (const art of articles) {
              const text = art.textContent?.trim().slice(0, 300) || "";
              if (text.length > 20) {
                items.push({ content: text, author: "Unknown" });
              }
            }
            return items.slice(0, 10);
          });

          if (posts.length > 0) {
            console.log(`  ✅ Found ${posts.length} pending items on ${p.name}`);
            for (const post of posts) {
              const lower = post.content.toLowerCase();
              let recommendation = "approve";
              let reason = "Nội dung trung tính";

              if (/bán|mua|giá|ship|order|sale|quảng cáo|ads|shop|giảm giá|freeship/i.test(lower)) {
                recommendation = "reject";
                reason = "🚫 Bán hàng / quảng cáo";
              } else if (/chính trị|đảng|bầu cử|biểu tình|cộng sản/i.test(lower)) {
                recommendation = "reject";
                reason = "🚫 Nội dung chính trị";
              } else if (/chửi|đm|clm|vcl|ngu|đéo|fuck|shit|hate/i.test(lower)) {
                recommendation = "reject";
                reason = "🚫 Nội dung tiêu cực / toxic";
              } else if (/phật|pháp|đạo|thiền|niệm|kinh|chùa|tu |giác ngộ|từ bi|bồ tát|buddhis|dharma/i.test(lower)) {
                recommendation = "approve";
                reason = "✅ Phật Pháp / Đạo";
              } else if (/tích cực|yêu thương|hạnh phúc|cảm ơn|biết ơn|bình an|an lạc/i.test(lower)) {
                recommendation = "approve";
                reason = "✅ Nội dung tích cực";
              }

              moderationResults.push({
                page: p.name,
                content: post.content.slice(0, 200),
                author: post.author,
                recommendation,
                reason,
              });
            }
          }
          break; // Found working URL, skip others
        }
      }
    } catch {
      continue;
    }
  }

  console.log(`\n  📊 TỔNG KẾT KIỂM DUYỆT:`);
  console.log(`  Total pending: ${moderationResults.length}`);
  
  const approves = moderationResults.filter(m => m.recommendation === "approve");
  const rejects = moderationResults.filter(m => m.recommendation === "reject");
  console.log(`  ✅ Đề xuất DUYỆT: ${approves.length}`);
  console.log(`  ❌ Đề xuất TỪ CHỐI: ${rejects.length}`);

  for (const m of moderationResults) {
    const icon = m.recommendation === "approve" ? "✅" : "❌";
    console.log(`\n  ${icon} [${m.page}] by ${m.author}`);
    console.log(`     Content: ${m.content.slice(0, 120)}...`);
    console.log(`     → ${m.reason}`);
  }

  // ─── SAVE REPORT ───────────────────────────────────────────────
  const report = {
    timestamp: ts(),
    profile,
    notifications,
    pages: pageInfo,
    moderation: moderationResults,
    summary: {
      totalNotifications: notifications.length,
      totalPages: pageInfo.length,
      totalPending: moderationResults.length,
      toApprove: approves.length,
      toReject: rejects.length,
    },
  };

  const logsDir = "./data/logs";
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  fs.writeFileSync(`${logsDir}/scan_report_v2.json`, JSON.stringify(report, null, 2));

  // Save final cookies
  const finalCookies = await ctx.cookies();
  fs.writeFileSync(cookiePath, JSON.stringify(finalCookies, null, 2));
  console.log(`\n${ts()} 🍪 Cookies refreshed (${finalCookies.length})`);

  console.log(`\n${"=".repeat(60)}`);
  console.log(`${ts()} 🏁 DRY-RUN SCAN COMPLETE — NO ACTIONS TAKEN`);
  console.log(`${"=".repeat(60)}`);

  await delay(3000);
  await browser.close();
})();
