import { fileURLToPath } from "node:url";
import { dirname as __dirnameFn } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = __dirnameFn(__filename);
/**
 * fb_core.ts — Login, session management, and cookie persistence.
 *
 * Handles browser initialization, Facebook login with 2FA support,
 * and cookie save/load for session continuity.
 *
 * @module fb_core
 */

import { chromium, Browser, Page, BrowserContext } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { humanType, humanClick, randomDelay, humanPause } from "./humanmode.js";

// ─── Types ────────────────────────────────────────────────────────

export interface BrowserConfig {
  viewport: { width: number; height: number; randomize: number };
  userAgent: string;
  headless: boolean;
  cookiePath: string;
}

export interface Config {
  timing: Record<string, [number, number]>;
  behavior: Record<string, unknown>;
  browser: BrowserConfig;
  ai: {
    ollamaUrl: string;
    model: string;
    fallbackModel: string;
    systemPrompt: string;
  };
  facebook: {
    language: string;
    pageUrl: string;
    profileUrl: string;
  };
}

export interface SessionContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  config: Config;
}

// ─── Config Loading ───────────────────────────────────────────────

const CONFIG_DIR = path.join(__dirname, "..", "config");

/**
 * Load the default configuration from config/default.json.
 * @returns Parsed Config object
 */
export function loadConfig(): Config {
  const raw = fs.readFileSync(path.join(CONFIG_DIR, "default.json"), "utf-8");
  return JSON.parse(raw) as Config;
}

// ─── Timestamp Utility ───────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── Browser Initialization ──────────────────────────────────────

/**
 * Launch Chromium with human-like configuration.
 * Loads cookies if available. Returns browser, context, and page.
 * @param config - Full config object
 * @returns SessionContext with browser, context, and page
 */
export async function initBrowser(config: Config): Promise<SessionContext> {
  const bc = config.browser;
  const randOffset = bc.viewport.randomize;
  const width = bc.viewport.width + Math.floor(Math.random() * randOffset * 2 - randOffset);
  const height = bc.viewport.height + Math.floor(Math.random() * randOffset * 2 - randOffset);

  console.log(`${ts()} 🚀 Launching browser (${width}x${height})`);

  const browser = await chromium.launch({
    headless: bc.headless,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const context = await browser.newContext({
    viewport: { width, height },
    userAgent: bc.userAgent,
    locale: config.facebook.language === "vi" ? "vi-VN" : "en-US",
    timezoneId: "Asia/Bangkok",
  });

  // Mask webdriver detection
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const page = await context.newPage();

  // Try to load cookies
  const cookieLoaded = await loadCookies(context, bc.cookiePath);
  if (cookieLoaded) {
    console.log(`${ts()} 🍪 Cookies loaded from ${bc.cookiePath}`);
  } else {
    console.log(`${ts()} 🍪 No valid cookies found — fresh session`);
  }

  return { browser, context, page, config };
}

// ─── Cookie Management ───────────────────────────────────────────

/**
 * Save browser cookies to a JSON file.
 * @param context - Playwright BrowserContext
 * @param cookiePath - File path to save cookies to
 */
export async function saveCookies(context: BrowserContext, cookiePath: string): Promise<void> {
  const dir = path.dirname(cookiePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const cookies = await context.cookies();
  fs.writeFileSync(cookiePath, JSON.stringify(cookies, null, 2), "utf-8");
  console.log(`${ts()} 🍪 Saved ${cookies.length} cookies to ${cookiePath}`);
}

/**
 * Load cookies from a JSON file into the browser context.
 * Returns false if file doesn't exist or cookies are expired.
 * @param context - Playwright BrowserContext
 * @param cookiePath - File path to load cookies from
 * @returns true if cookies were loaded successfully
 */
export async function loadCookies(context: BrowserContext, cookiePath: string): Promise<boolean> {
  try {
    if (!fs.existsSync(cookiePath)) return false;
    const raw = fs.readFileSync(cookiePath, "utf-8");
    const cookies = JSON.parse(raw) as Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires: number;
      httpOnly: boolean;
      secure: boolean;
      sameSite: "Strict" | "Lax" | "None";
    }>;

    // Filter out expired cookies
    const now = Date.now() / 1000;
    const validCookies = cookies.filter((c) => !c.expires || c.expires === -1 || c.expires > now);

    if (validCookies.length === 0) return false;

    await context.addCookies(validCookies);
    return true;
  } catch (err) {
    console.log(`${ts()} ⚠️ Failed to load cookies: ${(err as Error).message}`);
    return false;
  }
}

// ─── Login ────────────────────────────────────────────────────────

/** Fallback selectors for Facebook login form elements. */
const SELECTORS = {
  emailInput: [
    '#email',
    'input[name="email"]',
    'input[type="email"]',
    'input[aria-label="Email address or phone number"]',
    'input[aria-label="Địa chỉ email hoặc số điện thoại"]',
  ],
  passwordInput: [
    '#pass',
    'input[name="pass"]',
    'input[type="password"]',
    'input[aria-label="Password"]',
    'input[aria-label="Mật khẩu"]',
  ],
  loginButton: [
    'div[role="button"]:has-text("Log in")',
    'div[role="button"]:has-text("Đăng nhập")',
    'button[name="login"]',
    'button[data-testid="royal_login_button"]',
    'button[type="submit"]',
    'button:has-text("Log In")',
    'button:has-text("Đăng nhập")',
    'button:has-text("Log in")',
    'input[type="submit"]',
    '#loginbutton',
    'label#loginbutton',
  ],
};

/**
 * Try multiple selectors until one is found.
 * @param page - Playwright Page
 * @param selectors - Array of selectors to try
 * @param timeout - Timeout per selector in ms (default 3000)
 * @returns The first matching selector string, or null
 */
async function findSelector(page: Page, selectors: string[], timeout = 3000): Promise<string | null> {
  for (const sel of selectors) {
    try {
      const el = await page.waitForSelector(sel, { timeout, state: "visible" });
      if (el) return sel;
    } catch {
      // try next
    }
  }
  return null;
}

/**
 * Log in to Facebook with email and password.
 * Supports 2FA: waits up to 90s for the user to approve manually.
 * Saves cookies on success.
 *
 * @param session - SessionContext with page, context, and config
 * @param email - Facebook email or phone number
 * @param password - Facebook password
 * @returns true if login succeeded
 */
export async function login(
  session: SessionContext,
  email: string,
  password: string
): Promise<boolean> {
  const { page, context, config } = session;

  console.log(`${ts()} 🔐 Starting login flow...`);

  try {
    await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded" });
    await randomDelay(2000, 4000);

    // Find and fill email
    const emailSel = await findSelector(page, SELECTORS.emailInput);
    if (!emailSel) throw new Error("Email input not found");

    await humanClick(page, emailSel);
    await humanType(page, emailSel, email);
    await randomDelay(500, 1000);

    // Find and fill password
    const passSel = await findSelector(page, SELECTORS.passwordInput);
    if (!passSel) throw new Error("Password input not found");

    await humanClick(page, passSel);
    await humanType(page, passSel, password);
    await randomDelay(500, 1500);

    // Click login button
    const loginSel = await findSelector(page, SELECTORS.loginButton, 10000);
    if (!loginSel) throw new Error("Login button not found");

    await humanClick(page, loginSel);
    console.log(`${ts()} 🔐 Credentials submitted, waiting for response...`);

    // Wait for navigation — might land on feed, 2FA, or error
    await page.waitForNavigation({ timeout: 15_000 }).catch(() => {});
    await randomDelay(3000, 5000);

    // Debug: log current URL and save screenshot
    const currentUrl = page.url();
    console.log(`${ts()} 📍 Current URL: ${currentUrl}`);
    
    // Ensure log directory exists
    const logDir = './data/logs';
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    await page.screenshot({ path: path.join(logDir, 'login-debug.png') }).catch(() => {});

    // Check for 2FA or checkpoint
    const twoFaDetected = await page.$('input[name="approvals_code"], #approvals_code, input[aria-label*="code" i]');
    const checkpointDetected = currentUrl.includes('checkpoint') || currentUrl.includes('two_step');
    
    if (twoFaDetected || checkpointDetected) {
      console.log(`${ts()} 🔑 2FA/Checkpoint detected! Please approve within 90 seconds...`);
      console.log(`${ts()} 📍 Page: ${currentUrl}`);
      // Wait for navigation away from 2FA/checkpoint page
      try {
        await page.waitForURL((url) => {
          const u = url.toString();
          return u.includes('facebook.com') && !u.includes('login') && !u.includes('checkpoint') && !u.includes('two_step');
        }, { timeout: 90_000 });
      } catch {
        // Also check if we ended up on the feed anyway
        const loggedIn = await isLoggedIn(page);
        if (!loggedIn) {
          console.log(`${ts()} ❌ 2FA timeout — login failed`);
          return false;
        }
      }
    }

    // Verify login
    await randomDelay(2000, 4000);
    const success = await isLoggedIn(page);

    if (success) {
      console.log(`${ts()} ✅ Login successful!`);
      await saveCookies(context, config.browser.cookiePath);
      return true;
    } else {
      console.log(`${ts()} ❌ Login failed — could not verify logged-in state`);
      return false;
    }
  } catch (err) {
    console.log(`${ts()} ❌ Login error: ${(err as Error).message}`);
    return false;
  }
}

/**
 * Login with automatic retry and hard limit.
 * Stops after maxAttempts and returns a detailed report.
 *
 * @param session - SessionContext
 * @param email - Facebook email
 * @param password - Facebook password
 * @param maxAttempts - Maximum login attempts (default: 3)
 * @returns Object with success status, attempts made, and failure reasons
 */
export async function loginWithRetry(
  session: SessionContext,
  email: string,
  password: string,
  maxAttempts = 3,
): Promise<{ success: boolean; attempts: number; reasons: string[] }> {
  const reasons: string[] = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`${ts()} 🔄 Login attempt ${attempt}/${maxAttempts}...`);

    const success = await login(session, email, password);
    if (success) {
      console.log(`${ts()} ✅ Login succeeded on attempt ${attempt}`);
      return { success: true, attempts: attempt, reasons };
    }

    // Capture reason from current page state
    const url = session.page.url();
    let reason = `Attempt ${attempt}: failed`;
    if (url.includes("two_step")) reason = `Attempt ${attempt}: 2FA required`;
    else if (url.includes("checkpoint")) reason = `Attempt ${attempt}: checkpoint/captcha`;
    else if (url.includes("login")) reason = `Attempt ${attempt}: credentials rejected or page error`;
    reasons.push(reason);

    if (attempt < maxAttempts) {
      const waitMs = attempt * 5000; // backoff: 5s, 10s
      console.log(`${ts()} ⏳ Waiting ${waitMs / 1000}s before retry...`);
      await randomDelay(waitMs, waitMs + 2000);
    }
  }

  console.log(`${ts()} 🛑 LOGIN FAILED after ${maxAttempts} attempts. Stopping.`);
  console.log(`${ts()} 📋 Reasons:`);
  for (const r of reasons) console.log(`   - ${r}`);

  return { success: false, attempts: maxAttempts, reasons };
}

/**
 * Check if the user is currently logged in to Facebook.
 * Looks for typical logged-in page indicators.
 * @param page - Playwright Page
 * @returns true if currently logged in
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  const indicators = [
    'div[role="navigation"]',
    'div[aria-label="Facebook"]',
    'a[href="/me/"]',
    'a[aria-label="Profile"]',
    'a[aria-label="Trang cá nhân"]',
    'svg[aria-label="Your profile"]',
    'div[data-pagelet="LeftRail"]',
    'div[role="banner"]',
  ];

  for (const sel of indicators) {
    try {
      const el = await page.$(sel);
      if (el) return true;
    } catch {
      // try next
    }
  }

  // Also check URL — if on feed, we're logged in
  const url = page.url();
  if (url.includes("facebook.com") && !url.includes("/login") && !url.includes("/checkpoint")) {
    // Check for feed content as final confirmation
    try {
      const feed = await page.$('div[role="feed"], div[role="main"]');
      if (feed) return true;
    } catch {
      // ignore
    }
  }

  return false;
}

// ─── CLI Entry ────────────────────────────────────────────────────

/**
 * CLI entry point — run with: tsx fb_core.ts [command]
 * Commands: login
 */
async function main(): Promise<void> {
  const command = process.argv[2];
  const config = loadConfig();

  const email = process.env["FB_EMAIL"];
  const password = process.env["FB_PASS"];

  if (!email || !password) {
    console.error("❌ Set FB_EMAIL and FB_PASS environment variables");
    process.exit(1);
  }

  const session = await initBrowser(config);

  try {
    switch (command) {
      case "login": {
        const success = await login(session, email, password);
        if (!success) process.exit(1);
        break;
      }
      default:
        console.log(`Usage: tsx fb_core.ts [login|post|comment|feed]`);
        break;
    }
  } finally {
    await humanPause("think");
    await session.browser.close();
  }
}

// Run if executed directly
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").includes("fb_core");
if (isDirectRun) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
