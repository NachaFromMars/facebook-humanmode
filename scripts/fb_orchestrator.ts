/**
 * fb_orchestrator.ts — Main session orchestrator for Facebook HumanMode.
 *
 * Manages session lifecycle: login, action planning, mood-based behavior,
 * scheduled sessions with sleep hours and break periods.
 *
 * @module fb_orchestrator
 */

import * as fs from "node:fs";
import * as path from "node:path";
import {
  initBrowser,
  login,
  loginWithRetry,
  saveCookies,
  isLoggedIn,
  loadConfig,
  type SessionContext,
  type Config,
} from "./fb_core.js";
import { browseFeed } from "./fb_feed.js";
import { createPost } from "./fb_post.js";
import { checkNotifications, respondToNotification } from "./fb_notification.js";
import { checkMessages, respondToUnreadMessages } from "./fb_messenger.js";
import { randomDelay, humanPause } from "./humanmode.js";

// ─── Types ────────────────────────────────────────────────────────

type SessionMood = "active" | "moderate" | "quiet" | "lurk";

// ─── Timestamp Utility ───────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── Mood Selection ──────────────────────────────────────────────

/**
 * Select session mood based on weighted randomness.
 */
function selectMood(weights?: Partial<Record<SessionMood, number>>): SessionMood {
  const defaultWeights: Record<SessionMood, number> = {
    active: 0.2,
    moderate: 0.4,
    quiet: 0.3,
    lurk: 0.1,
  };

  const finalWeights: Record<SessionMood, number> = { ...defaultWeights, ...weights };
  const rand = Math.random();
  let cumulative = 0;

  for (const [mood, weight] of Object.entries(finalWeights)) {
    cumulative += weight;
    if (rand < cumulative) return mood as SessionMood;
  }

  return "moderate";
}

// ─── Action Planning ─────────────────────────────────────────────

/**
 * Plan action sequence based on mood.
 */
function planActions(mood: SessionMood): string[] {
  let actions: string[];

  switch (mood) {
    case "active":
      actions = [
        "browse_feed", "react", "comment", "check_notifications",
        "browse_feed", "react", "check_messages", "browse_feed", "comment",
      ];
      break;
    case "moderate":
      actions = [
        "browse_feed", "react", "check_notifications",
        "browse_feed", "comment", "check_messages",
      ];
      break;
    case "quiet":
      actions = ["browse_feed", "check_notifications", "browse_feed"];
      break;
    case "lurk":
      actions = ["browse_feed"];
      break;
  }

  // Random subset
  return actions.slice(0, Math.max(1, Math.ceil(actions.length * Math.random())));
}

// ─── Action Execution ────────────────────────────────────────────

/**
 * Execute a single action using the current session.
 */
async function executeAction(
  session: SessionContext,
  action: string,
): Promise<void> {
  const { page, config } = session;

  switch (action) {
    case "browse_feed":
      console.log(`${ts()} 📰 Browsing feed...`);
      await browseFeed(page, config, {
        postsToInteractWith: Math.floor(Math.random() * 3) + 1,
        reactProbability: 0.3,
        commentProbability: 0.15,
        distractionProbability: 0.1,
      });
      break;

    case "react":
      console.log(`${ts()} 👍 Reacting to posts...`);
      await browseFeed(page, config, {
        postsToInteractWith: 2,
        reactProbability: 0.8,
        commentProbability: 0.0,
        distractionProbability: 0.05,
      });
      break;

    case "comment":
      console.log(`${ts()} 💬 Commenting on posts...`);
      await browseFeed(page, config, {
        postsToInteractWith: 1,
        reactProbability: 0.2,
        commentProbability: 0.8,
        distractionProbability: 0.05,
      });
      break;

    case "check_notifications": {
      console.log(`${ts()} 🔔 Checking notifications...`);
      const notifications = await checkNotifications(page);
      for (const notif of notifications.slice(0, 2)) {
        try {
          await respondToNotification(page, config, notif);
          await randomDelay(5000, 10000);
        } catch {
          continue;
        }
      }
      break;
    }

    case "check_messages":
      console.log(`${ts()} 💬 Checking messages...`);
      await respondToUnreadMessages(page, "Thanks for the message!");
      break;

    default:
      console.log(`${ts()} ❓ Unknown action: ${action}`);
  }
}

// ─── Session Runner ──────────────────────────────────────────────

/**
 * Start a single Facebook session.
 * Handles login, mood selection, action queue, and cleanup.
 */
export async function startSession(config: Config): Promise<void> {
  const email = process.env["FB_EMAIL"];
  const password = process.env["FB_PASS"];

  if (!email || !password) {
    console.error("❌ FB_EMAIL and FB_PASS environment variables required");
    process.exit(1);
  }

  const sessionStart = Date.now();
  const [minLen, maxLen] = config.timing.sessionLength ?? [900_000, 2_700_000];
  const sessionLength = Math.random() * (maxLen - minLen) + minLen;

  console.log(`\n${"=".repeat(60)}`);
  console.log("🚀 FACEBOOK HUMANMODE SESSION START");
  console.log(`${"=".repeat(60)}`);
  console.log(`⏱️  Session duration: ${Math.round(sessionLength / 1000 / 60)} minutes`);

  const session = await initBrowser(config);

  try {
    // Check if already logged in via cookies
    await session.page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);
    let loggedIn = await isLoggedIn(session.page);

    // Login if needed (max 3 attempts)
    if (!loggedIn) {
      console.log(`${ts()} 🔐 Logging in (max 3 attempts)...`);
      const result = await loginWithRetry(session, email, password, 3);
      if (!result.success) {
        console.error(`${ts()} 🛑 Login failed after ${result.attempts} attempts. STOPPING.`);
        for (const r of result.reasons) console.error(`   - ${r}`);
        return;
      }
    } else {
      console.log(`${ts()} ✅ Already logged in`);
    }

    // Determine mood
    const moodWeights = config.behavior.moodWeights as
      Partial<Record<SessionMood, number>> | undefined;
    const mood = selectMood(moodWeights);
    console.log(`${ts()} 😊 Session mood: ${mood}`);

    // Plan actions
    const actionQueue = planActions(mood);
    console.log(`${ts()} 📋 Actions: ${actionQueue.join(", ")}`);

    // Execute
    for (const action of actionQueue) {
      if (Date.now() - sessionStart > sessionLength) {
        console.log(`${ts()} ⏰ Session time limit reached`);
        break;
      }

      try {
        await executeAction(session, action);
      } catch (error) {
        console.error(`${ts()} ❌ Action failed: ${action}`, error);
      }

      await humanPause("between_comments");
    }

    // Save cookies
    await saveCookies(session.context, config.browser.cookiePath);

    const elapsed = Math.round((Date.now() - sessionStart) / 1000 / 60);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ Session complete (${elapsed} minutes)`);
    console.log(`${"=".repeat(60)}\n`);
  } catch (error) {
    console.error(`${ts()} ❌ Session error:`, error);
  } finally {
    await session.browser.close();
  }
}

// ─── Schedule Runner ─────────────────────────────────────────────

/**
 * Run full daily schedule with multiple sessions and breaks.
 */
export async function runSchedule(config: Config): Promise<void> {
  const maxSessions = 6;
  const [breakMin, breakMax] = config.timing.breakLength ?? [1_800_000, 7_200_000];
  const sleepHours = (config.behavior.sleepHours as [number, number]) ?? [22, 7];

  console.log(`\n${"#".repeat(60)}`);
  console.log("🌐 FACEBOOK HUMANMODE SCHEDULER");
  console.log(`${"#".repeat(60)}\n`);

  let sessionCount = 0;

  while (sessionCount < maxSessions) {
    const hour = new Date().getHours();
    const [sleepStart, sleepEnd] = sleepHours;

    // Check sleep
    const inSleep = sleepStart > sleepEnd
      ? hour >= sleepStart || hour < sleepEnd
      : hour >= sleepStart && hour < sleepEnd;

    if (inSleep) {
      console.log(`${ts()} 😴 Sleep hours (${sleepStart}:00-${sleepEnd}:00). Waiting...`);
      await randomDelay(3_600_000, 7_200_000);
      continue;
    }

    console.log(`\n${ts()} 📊 Session ${sessionCount + 1}/${maxSessions}`);
    await startSession(config);
    sessionCount++;

    if (sessionCount < maxSessions) {
      const breakLength = Math.random() * (breakMax - breakMin) + breakMin;
      console.log(`\n${ts()} ⏸️ Break for ${Math.round(breakLength / 1000 / 60)} minutes...`);
      await randomDelay(Math.round(breakLength), Math.round(breakLength));
    }
  }

  console.log(`\n${"#".repeat(60)}`);
  console.log(`✅ Daily schedule complete (${sessionCount} sessions)`);
  console.log(`${"#".repeat(60)}\n`);
}

// ─── CLI Entry ────────────────────────────────────────────────────

const isDirectRun = process.argv[1]?.replace(/\\\\/g, "/").includes("fb_orchestrator");
if (isDirectRun) {
  const command = process.argv[2] || "session";
  const config = loadConfig();

  (async () => {
    try {
      switch (command) {
        case "run":
          await runSchedule(config);
          break;
        case "session":
          await startSession(config);
          break;
        default:
          console.log("Commands: run (schedule), session (single)");
      }
    } catch (error) {
      console.error("❌ Fatal:", error);
      process.exit(1);
    }
  })();
}
