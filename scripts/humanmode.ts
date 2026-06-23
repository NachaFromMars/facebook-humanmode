import { fileURLToPath } from "node:url";
import { dirname as __dirnameFn } from "node:path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = __dirnameFn(__filename);
/**
 * HumanMode Engine — Facebook HumanMode V1.0 - Nacharium
 *
 * Provides human-like interaction primitives: Bézier mouse movement,
 * natural typing with typo injection/correction, human scrolling,
 * random delays, distraction events, and profile peeking.
 *
 * @module humanmode
 */

import { Page, ElementHandle } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

// ─── Config Loading ───────────────────────────────────────────────

interface TimingConfig {
  charDelay: [number, number];
  wordDelay: [number, number];
  thinkDelay: [number, number];
  readDelay: [number, number];
  betweenComments: [number, number];
  scrollDelay: [number, number];
  sessionLength: [number, number];
  breakLength: [number, number];
}

interface BehaviorConfig {
  typoRate: number;
  distractionRate: number;
  imageOpenRate: number;
  profilePeekRate: number;
  reactRate: number;
  commentRate: number;
  sleepHours: [number, number];
  moodWeights: Record<string, number>;
}

interface HumanModeConfig {
  timing: TimingConfig;
  behavior: BehaviorConfig;
}

const CONFIG_PATH = path.join(__dirname, "..", "config", "default.json");

let _config: HumanModeConfig | null = null;

/**
 * Load and cache the default config from disk.
 */
function getConfig(): HumanModeConfig {
  if (!_config) {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    _config = JSON.parse(raw) as HumanModeConfig;
  }
  return _config;
}

// ─── Utility ──────────────────────────────────────────────────────

/**
 * Return a random integer between min (inclusive) and max (inclusive).
 */
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Return a random float between min and max.
 */
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * Timestamp prefix for logs.
 */
function ts(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

// ─── Delays ───────────────────────────────────────────────────────

/**
 * Wait for a random duration between min and max milliseconds.
 * @param min - Minimum delay in ms
 * @param max - Maximum delay in ms
 */
export async function randomDelay(min: number, max: number): Promise<void> {
  const ms = randInt(min, max);
  await new Promise<void>((r) => setTimeout(r, ms));
}

/**
 * Semantic human pause — delays calibrated to action context.
 * @param action - Type of pause: think, read, between_comments, distraction
 */
export async function humanPause(
  action: "think" | "read" | "between_comments" | "distraction"
): Promise<void> {
  const cfg = getConfig().timing;
  switch (action) {
    case "think":
      await randomDelay(cfg.thinkDelay[0], cfg.thinkDelay[1]);
      break;
    case "read":
      await randomDelay(cfg.readDelay[0], cfg.readDelay[1]);
      break;
    case "between_comments":
      await randomDelay(cfg.betweenComments[0], cfg.betweenComments[1]);
      break;
    case "distraction":
      await randomDelay(2000, 5000);
      break;
  }
}

// ─── Bézier Mouse Movement ───────────────────────────────────────

interface Point {
  x: number;
  y: number;
}

/**
 * Compute a point on a cubic Bézier curve at parameter t ∈ [0, 1].
 */
function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
  };
}

/**
 * Generate Bézier control points with randomness for a natural-looking curve.
 */
function generateControlPoints(start: Point, end: Point): [Point, Point, Point, Point] {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const jitter = 30;

  const cp1: Point = {
    x: start.x + dx * randFloat(0.2, 0.4) + randInt(-jitter, jitter),
    y: start.y + dy * randFloat(0.0, 0.3) + randInt(-jitter, jitter),
  };
  const cp2: Point = {
    x: start.x + dx * randFloat(0.6, 0.8) + randInt(-jitter, jitter),
    y: start.y + dy * randFloat(0.7, 1.0) + randInt(-jitter, jitter),
  };

  return [start, cp1, cp2, end];
}

/**
 * Easing function: slow start, fast middle, slow end.
 */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Move the mouse along a Bézier curve to (x, y) with human-like speed.
 * Occasionally overshoots and corrects.
 * @param page - Playwright Page
 * @param x - Target x coordinate
 * @param y - Target y coordinate
 */
export async function humanMove(page: Page, x: number, y: number): Promise<void> {
  const mouse = page.mouse;
  // Get current position (default 0,0 if never moved)
  const start: Point = await page.evaluate(() => ({
    x: ((window as unknown as Record<string, unknown>).__hmX as number) ?? 0,
    y: ((window as unknown as Record<string, unknown>).__hmY as number) ?? 0,
  }));

  const overshoot = Math.random() < 0.15;
  let target: Point = { x, y };

  if (overshoot) {
    const overshootPx = randInt(5, 15);
    const angle = Math.atan2(y - start.y, x - start.x);
    target = {
      x: x + Math.cos(angle) * overshootPx,
      y: y + Math.sin(angle) * overshootPx,
    };
  }

  const [p0, p1, p2, p3] = generateControlPoints(start, target);
  const dist = Math.hypot(target.x - start.x, target.y - start.y);
  const steps = Math.max(10, Math.min(50, Math.round(dist / 10)));
  const totalTime = randInt(200, 500);

  for (let i = 1; i <= steps; i++) {
    const rawT = i / steps;
    const t = easeInOutCubic(rawT);
    const pt = cubicBezier(p0, p1, p2, p3, t);
    await mouse.move(pt.x, pt.y);
    await new Promise<void>((r) => setTimeout(r, totalTime / steps));
  }

  // Correct overshoot
  if (overshoot) {
    await new Promise<void>((r) => setTimeout(r, randInt(50, 120)));
    await mouse.move(x, y, { steps: randInt(3, 6) });
  }

  // Store position for next call
  await page.evaluate(
    ([cx, cy]) => {
      (window as unknown as Record<string, unknown>).__hmX = cx;
      (window as unknown as Record<string, unknown>).__hmY = cy;
    },
    [x, y] as [number, number]
  );
}

/**
 * Move to an element and click it with human-like behavior.
 * Falls back to page.click if the element's bounding box is unavailable.
 * @param page - Playwright Page
 * @param selector - CSS / Playwright selector for the target element
 */
export async function humanClick(page: Page, selector: string): Promise<void> {
  const el = await page.waitForSelector(selector, { timeout: 10_000 });
  if (!el) {
    throw new Error(`[humanClick] Element not found: ${selector}`);
  }
  const box = await el.boundingBox();
  if (box) {
    const tx = box.x + box.width * randFloat(0.25, 0.75);
    const ty = box.y + box.height * randFloat(0.25, 0.75);
    await humanMove(page, tx, ty);
    await randomDelay(80, 200);
    await page.mouse.click(tx, ty);
  } else {
    // Fallback — element may be off-screen but interactable
    await el.click();
  }
  console.log(`${ts()} 🖱️ Clicked: ${selector}`);
}

// ─── Typo Engine ──────────────────────────────────────────────────

/**
 * Adjacent key map for QWERTY layout (includes Vietnamese common chars).
 */
const ADJACENT_KEYS: Record<string, string[]> = {
  q: ["w", "a"],
  w: ["q", "e", "s"],
  e: ["w", "r", "d"],
  r: ["e", "t", "f"],
  t: ["r", "y", "g"],
  y: ["t", "u", "h"],
  u: ["y", "i", "j"],
  i: ["u", "o", "k"],
  o: ["i", "p", "l"],
  p: ["o", "[", ";"],
  a: ["q", "s", "z"],
  s: ["a", "d", "w", "x"],
  d: ["s", "f", "e", "c"],
  f: ["d", "g", "r", "v"],
  g: ["f", "h", "t", "b"],
  h: ["g", "j", "y", "n"],
  j: ["h", "k", "u", "m"],
  k: ["j", "l", "i"],
  l: ["k", ";", "o"],
  z: ["a", "x"],
  x: ["z", "c", "s"],
  c: ["x", "v", "d"],
  v: ["c", "b", "f"],
  b: ["v", "n", "g"],
  n: ["b", "m", "h"],
  m: ["n", "j"],
};

type TypoType = "adjacent" | "double" | "missing" | "swap";

/**
 * Generate a single typo in a word. Returns the corrupted word and the type of typo.
 */
function injectTypo(word: string): { result: string; typoType: TypoType; pos: number } {
  const types: TypoType[] = ["adjacent", "double", "missing", "swap"];
  const typoType = types[randInt(0, types.length - 1)];
  // Pick a random char position (skip first/last for some types)
  const safeStart = 1;
  const safeEnd = Math.max(safeStart, word.length - 2);
  const pos = randInt(safeStart, safeEnd);
  const ch = word[pos];

  switch (typoType) {
    case "adjacent": {
      const lc = ch.toLowerCase();
      const neighbors = ADJACENT_KEYS[lc];
      if (neighbors && neighbors.length > 0) {
        const replacement = neighbors[randInt(0, neighbors.length - 1)];
        const finalChar = ch === ch.toUpperCase() ? replacement.toUpperCase() : replacement;
        return { result: word.slice(0, pos) + finalChar + word.slice(pos + 1), typoType, pos };
      }
      // Fall through to double if no adjacent key found
      return { result: word.slice(0, pos) + ch + word, typoType: "double", pos };
    }
    case "double":
      return { result: word.slice(0, pos) + ch + word.slice(pos), typoType, pos };
    case "missing":
      if (word.length <= 2) {
        // Don't remove from very short words; double instead
        return { result: word.slice(0, pos) + ch + word.slice(pos), typoType: "double", pos };
      }
      return { result: word.slice(0, pos) + word.slice(pos + 1), typoType, pos };
    case "swap":
      if (pos < word.length - 1) {
        const arr = word.split("");
        [arr[pos], arr[pos + 1]] = [arr[pos + 1], arr[pos]];
        return { result: arr.join(""), typoType, pos };
      }
      return { result: word, typoType, pos };
  }
}

// ─── Human Typing ─────────────────────────────────────────────────

export interface ScrollOptions {
  /** Minimum pixels per scroll step */
  minPx?: number;
  /** Maximum pixels per scroll step */
  maxPx?: number;
  /** Number of scroll steps */
  steps?: number;
  /** Direction: 'down' | 'up' */
  direction?: "down" | "up";
}

/**
 * Type text into a focused element with human-like rhythm, typo injection, and correction.
 * Typing speed varies: slow start, faster middle, slow end.
 * Long words may get a typo which is noticed, backspaced, and retyped correctly.
 *
 * ALWAYS finishes with the correct final text.
 *
 * @param page - Playwright Page
 * @param selector - Selector for the input element
 * @param text - The text to type
 */
export async function humanType(
  page: Page,
  selector: string,
  text: string
): Promise<void> {
  const cfg = getConfig();
  const typoRate = cfg.behavior.typoRate;
  const [charMin, charMax] = cfg.timing.charDelay;
  const [wordMin, wordMax] = cfg.timing.wordDelay;

  const el = await page.waitForSelector(selector, { timeout: 10_000 });
  if (!el) throw new Error(`[humanType] Element not found: ${selector}`);
  await el.click();
  await randomDelay(200, 500);

  const words = text.split(/(\s+)/); // preserve whitespace tokens
  const totalWords = words.filter((w) => w.trim().length > 0).length;
  let wordIndex = 0;

  for (const token of words) {
    if (token.trim().length === 0) {
      // Whitespace — type it directly
      for (const ch of token) {
        await page.keyboard.type(ch, { delay: randInt(charMin, charMax) });
      }
      continue;
    }

    wordIndex++;

    // Typing rhythm: slow start/end, faster middle
    const progress = totalWords > 1 ? (wordIndex - 1) / (totalWords - 1) : 0.5;
    const speedMultiplier =
      progress < 0.2 ? randFloat(1.2, 1.6) : progress > 0.8 ? randFloat(1.1, 1.5) : randFloat(0.7, 1.0);

    // Decide whether to inject a typo for this word
    const shouldTypo = token.length >= 4 && Math.random() < typoRate;

    if (shouldTypo) {
      const { result: typoWord, pos: typoPos } = injectTypo(token);
      // Type the typo version
      for (let i = 0; i < typoWord.length; i++) {
        const delay = Math.round(randInt(charMin, charMax) * speedMultiplier);
        await page.keyboard.type(typoWord[i], { delay });
      }
      // Pause — "notice" the error
      await randomDelay(500, 1500);
      // Backspace the wrong chars
      const charsToDelete = typoWord.length - typoPos;
      for (let i = 0; i < charsToDelete; i++) {
        await page.keyboard.press("Backspace");
        await randomDelay(100, 200);
      }
      // Retype the correct remainder
      const correctRemainder = token.slice(typoPos);
      for (const ch of correctRemainder) {
        const delay = Math.round(randInt(charMin, charMax) * speedMultiplier);
        await page.keyboard.type(ch, { delay });
      }
    } else {
      // Normal typing
      for (const ch of token) {
        const delay = Math.round(randInt(charMin, charMax) * speedMultiplier);
        await page.keyboard.type(ch, { delay });
      }
    }

    // Word pause
    await randomDelay(
      Math.round(wordMin * speedMultiplier),
      Math.round(wordMax * speedMultiplier)
    );
  }
  console.log(`${ts()} ⌨️ Typed ${text.length} chars into ${selector}`);
}

// ─── Human Scrolling ──────────────────────────────────────────────

/**
 * Scroll the page with variable speed, occasional pauses, and slight scroll-back.
 * @param page - Playwright Page
 * @param options - Scroll configuration
 */
export async function humanScroll(page: Page, options?: ScrollOptions): Promise<void> {
  const cfg = getConfig().timing;
  const minPx = options?.minPx ?? 300;
  const maxPx = options?.maxPx ?? 800;
  const steps = options?.steps ?? randInt(3, 7);
  const direction = options?.direction ?? "down";
  const sign = direction === "down" ? 1 : -1;

  for (let i = 0; i < steps; i++) {
    const amount = randInt(minPx, maxPx) * sign;
    await page.mouse.wheel(0, amount);
    await randomDelay(cfg.scrollDelay[0], cfg.scrollDelay[1]);

    // Occasional pause (30%)
    if (Math.random() < 0.3) {
      await randomDelay(1500, 4000);
    }

    // Occasional slight scroll back (15%)
    if (Math.random() < 0.15 && i < steps - 1) {
      const backAmount = randInt(50, 200) * -sign;
      await page.mouse.wheel(0, backAmount);
      await randomDelay(300, 800);
    }
  }
  console.log(`${ts()} 📜 Scrolled ${direction} ${steps} steps`);
}

/**
 * Simulate reading a page: scroll down slowly, pause, scroll back up once.
 * @param page - Playwright Page
 * @param times - Number of reading scroll cycles (default 2-3)
 */
export async function readingScroll(page: Page, times?: number): Promise<void> {
  const n = times ?? randInt(2, 3);
  for (let i = 0; i < n; i++) {
    await humanScroll(page, { steps: 1, minPx: 200, maxPx: 500, direction: "down" });
    await humanPause("read");
  }
  // Scroll back up slightly
  if (Math.random() < 0.6) {
    await humanScroll(page, { steps: 1, minPx: 100, maxPx: 250, direction: "up" });
    await randomDelay(1000, 2000);
  }
  console.log(`${ts()} 📖 Reading scroll completed (${n} cycles)`);
}

// ─── Distraction Events ──────────────────────────────────────────

/**
 * With a given probability, perform a random distraction:
 * click a post or image, look at it briefly, then go back.
 * @param page - Playwright Page
 * @param probability - Chance of distraction (default from config)
 * @returns true if a distraction happened
 */
export async function maybeDistraction(
  page: Page,
  probability?: number
): Promise<boolean> {
  const cfg = getConfig().behavior;
  const prob = probability ?? cfg.distractionRate;
  if (Math.random() >= prob) return false;

  console.log(`${ts()} 🎯 Distraction event triggered`);

  try {
    // Try clicking a random post link
    const links = await page.$$('div[data-pagelet*="FeedUnit"] a[href*="/posts/"], div[role="article"] a[href*="/posts/"]');
    if (links.length > 0) {
      const target = links[randInt(0, links.length - 1)];
      const box = await target.boundingBox();
      if (box) {
        await humanMove(page, box.x + box.width / 2, box.y + box.height / 2);
        await randomDelay(200, 400);
        await target.click();
        await randomDelay(3000, 5000);
        await page.goBack();
        await randomDelay(500, 1000);
        return true;
      }
    }
  } catch (err) {
    console.log(`${ts()} ⚠️ Distraction aborted: ${(err as Error).message}`);
  }
  return false;
}

/**
 * With a given probability, click an image to view full-size, wait, then close.
 * @param page - Playwright Page
 * @param probability - Chance of opening an image (default from config)
 */
export async function maybeOpenImage(
  page: Page,
  probability?: number
): Promise<void> {
  const cfg = getConfig().behavior;
  const prob = probability ?? cfg.imageOpenRate;
  if (Math.random() >= prob) return;

  console.log(`${ts()} 🖼️ Opening a random image`);

  try {
    const images = await page.$$(
      'div[role="article"] img[src*="scontent"], div[data-pagelet*="FeedUnit"] img[src*="scontent"]'
    );
    if (images.length === 0) return;

    const img = images[randInt(0, images.length - 1)];
    const box = await img.boundingBox();
    if (!box) return;

    await humanMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await randomDelay(150, 300);
    await img.click();
    await randomDelay(3000, 7000);

    // Close the image overlay — try Escape, then close button
    try {
      await page.keyboard.press("Escape");
    } catch {
      try {
        const closeBtn = await page.$('div[aria-label="Close"], div[aria-label="Đóng"], div[role="button"][aria-label*="close" i]');
        if (closeBtn) await closeBtn.click();
      } catch {
        // ignore
      }
    }
    await randomDelay(500, 1000);
  } catch (err) {
    console.log(`${ts()} ⚠️ Image open aborted: ${(err as Error).message}`);
  }
}

/**
 * With a given probability, click a user's profile picture/name, look briefly, then go back.
 * @param page - Playwright Page
 * @param probability - Chance of peeking at a profile (default from config)
 */
export async function maybeCheckProfile(
  page: Page,
  probability?: number
): Promise<void> {
  const cfg = getConfig().behavior;
  const prob = probability ?? cfg.profilePeekRate;
  if (Math.random() >= prob) return;

  console.log(`${ts()} 👤 Peeking at a profile`);

  try {
    const profileLinks = await page.$$(
      'div[role="article"] a[href*="/profile.php"], div[role="article"] a[role="link"][href*="facebook.com/"]'
    );
    if (profileLinks.length === 0) return;

    const link = profileLinks[randInt(0, profileLinks.length - 1)];
    const box = await link.boundingBox();
    if (!box) return;

    await humanMove(page, box.x + box.width / 2, box.y + box.height / 2);
    await randomDelay(200, 400);
    await link.click();
    await randomDelay(2000, 4000);
    await page.goBack();
    await randomDelay(500, 1000);
  } catch (err) {
    console.log(`${ts()} ⚠️ Profile peek aborted: ${(err as Error).message}`);
  }
}
