import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise(r => setTimeout(r, min + Math.random() * (max - min)));

async function humanType(page: any, text: string) {
  for (const char of text) {
    await page.keyboard.type(char, { delay: 55 + Math.random() * 95 });
    if (Math.random() < 0.04) await delay(200, 500);
  }
}

// Get random image from album
function getRandomImage(): string {
  const files = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  return path.join(ALBUM_DIR, files[Math.floor(Math.random() * files.length)]);
}

// Caption from args or random
const caption = process.argv[2] || "";
const imagePath = process.argv[3] || getRandomImage();

async function main() {
  console.log(`🦊 ĐĂNG BÀI: "${caption.slice(0, 50)}..."`);
  console.log(`📷 Ảnh: ${path.basename(imagePath)}`);
  
  const browser = await chromium.launch({ headless: true, args: ["--disable-blink-features=AutomationControlled"] });
  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN", timezoneId: "Asia/Ho_Chi_Minh",
  });
  await context.addInitScript(() => { Object.defineProperty(navigator, "webdriver", { get: () => undefined }); });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Scroll feed tự nhiên trước khi đăng
  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  if (page.url().includes("login")) { console.log("❌ Login failed"); await browser.close(); return; }
  
  // Scroll feed like human
  for (let i = 0; i < 2; i++) {
    await page.evaluate(() => window.scrollBy(0, 300 + Math.random() * 200));
    await delay(2000, 4000);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await delay(1500, 2500);

  // Open composer
  let composerOpened = false;
  for
