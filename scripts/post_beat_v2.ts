import { chromium } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

const BEAT_NUM = parseInt(process.env.BEAT || "1", 10);

const BEATS: Record<number, {title: string; content: string}> = {
  1: {
    title: "BA CUỘC GỌI NHỠ — Phần 1/9",
    content: `Ba cuộc gọi nhỡ.

Bình thường ai cũng có. Điện thoại reo, không bắt, cuộc gọi rơi vào im lặng. Xong. Không ai nghĩ gì. Nhưng ba cuộc gọi này — tôi không biết nữa. Tôi nghĩ về chúng nhiều hơn tôi nghĩ về những cuộc gọi tôi đã bắt máy.

Tôi là Dung, ba mươi tám tuổi. Kế toán. Sống ở Sài Gòn, một mình, căn hộ một phòng ngủ ở quận 7. Căn hộ nhỏ, sạch, mọi thứ đúng chỗ — giống công việc của tôi. Chính xác. Không thừa, không thiếu. Nhưng cũng không đủ.

Điện thoại nằm trên bàn. Tắt màn hình. Tôi nhìn nó — không phải nhìn cái máy, mà nhìn những thứ không còn hiển thị trên đó. Ba cuộc gọi nhỡ. Ba thời điểm khác nhau. Ba người khác nhau. Nhưng lý do tôi không bắt máy — chỉ có một.

Bên ngoài cửa sổ, Sài Gòn về đêm. Đèn đường, tiếng xe, tiếng ai đó cười ở tầng dưới. Tôi ngồi ghế sofa, chân co lên, tay ôm gối. Tư thế của người đang nghĩ. Hoặc của người đang tránh nghĩ mà không tránh được.`,
  },
  2: {
    title: "BA CUỘC GỌI NHỠ — Phần 2/9 | Cuộc gọi thứ hai: Hoàng",
    content: `Tôi nhớ rõ. Tối thứ bảy.

Căn hộ thuê ở Bình Thạnh lúc đó. Nhỏ hơn căn hộ bây giờ, nhưng ấm hơn — có cái kệ sách bằng gỗ tôi đóng từ hồi sinh viên, có tấm rèm cửa màu xanh rêu mà tôi mua ở chợ Tân Bình, có cái lò nướng nhỏ trên kệ bếp mà tôi dùng đúng ba lần rồi cất vì ngại dọn. Đời sống một mình nhưng không trống.

Tối thứ bảy — tôi nhớ vì hôm đó tôi định nấu canh chua cá lóc. Mới sáng đi chợ, mua cá, mua me, mua đậu bắp, mua giá. Cá đã làm sạch, nồi nước đang sôi. Tôi đứng trong bếp, tay cầm muỗng, và điện thoại reo.

Màn hình: Hoàng.

Hoàng. Người tôi yêu từ năm hai mươi ba đến năm hai mươi sáu. Ba năm. Chia tay không vì chuyện gì lớn. Chỉ là một ngày anh nói "anh mệt rồi," và tôi nói "em cũng vậy." Xong. Như hai người cùng buông tay một lúc, không ai buông trước.

Sau đó — năm năm. Không liên lạc. Không block, không xóa số, nhưng không nhắn tin, không gọi. Cái kiểu xa của những người không ghét nhau nhưng không biết nói gì nữa.`,
  },
};

const HASHTAGS = "#TieuTam #nho #ai #BaCuocGoiNho #truyen #vanviet #saigon #cuocsong #yeununhothigoingay";

function getRandomImage(): string {
  const files = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  return path.join(ALBUM_DIR, files[Math.floor(Math.random() * files.length)]);
}

async function main() {
  const beat = BEATS[BEAT_NUM];
  if (!beat) { console.log("No beat " + BEAT_NUM); return; }

  console.log("🦊 Đăng Beat " + BEAT_NUM + ": " + beat.title);

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
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  if (page.url().includes("login")) { console.log("❌ Expired!"); await browser.close(); return; }
  console.log("✅ Profile loaded");

  // Scroll to trigger
  await page.evaluate(() => { window.scrollBy(0, 300); });
  await delay(1500, 2500);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await delay(2000, 3000);

  // Click composer
  let clicked = false;
  try {
    const loc = page.locator('text=Bạn đang nghĩ gì');
    if (await loc.count() > 0) { await loc.first().click(); clicked = true; console.log("✅ Clicked composer"); }
  } catch {}

  if (!clicked) {
    clicked = await page.evaluate(() => {
      const els = document.querySelectorAll("span");
      for (const s of els) {
        if (s.textContent && s.textContent.includes("Bạn đang nghĩ gì")) { (s as HTMLElement).click(); return true; }
      }
      return false;
    });
  }

  if (!clicked) { console.log("❌ No composer"); await browser.close(); return; }
  await delay(3000, 5000);

  // Find textbox
  let tb = await page.$('div[role="dialog"] div[role="textbox"][contenteditable="true"]');
  if (!tb) tb = await page.$('div[role="textbox"][contenteditable="true"]');
  if (!tb) { console.log("❌ No textbox"); await page.screenshot({ path: path.join(LOG_DIR, "v2-no-tb-" + BEAT_NUM + ".png") }); await browser.close(); return; }

  await tb.click();
  await delay(500, 1000);

  const fullText = beat.title + "\n\n" + beat.content + "\n\n" + HASHTAGS;
  await page.keyboard.insertText(fullText);
  console.log("✍️ Text inserted (" + fullText.length + " chars)");
  await delay(1500, 2500);

  // Attach image
  const imgPath = getRandomImage();
  try {
    // Click photo/video option in composer
    const addBtns = await page.$$('div[role="dialog"] div[role="button"]');
    for (const btn of addBtns) {
      const label = await btn.getAttribute("aria-label");
      if (label && (label.includes("Ảnh") || label.includes("Photo") || label.includes("Video"))) {
        await btn.click();
        console.log("📷 Clicked photo button: " + label);
        await delay(1500, 2500);
        break;
      }
    }
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (fileInput) {
      await fileInput.setInputFiles(imgPath);
      console.log("📷 Attached: " + path.basename(imgPath));
      await delay(4000, 6000);
    }
  } catch (e: any) {
    console.log("⚠️ Image: " + (e.message || "").substring(0, 50));
  }

  // Screenshot before posting
  await page.screenshot({ path: path.join(LOG_DIR, "v2-before-post-" + BEAT_NUM + ".png") });

  // Try multiple methods to click Post/Đăng
  let posted = false;

  // Method 1: aria-label exact match
  for (const label of ["Đăng", "Post"]) {
    const btn = await page.$('div[role="dialog"] div[role="button"][aria-label="' + label + '"]');
    if (btn) {
      const disabled = await btn.getAttribute("aria-disabled");
      console.log("Found button [" + label + "] disabled=" + disabled);
      if (disabled !== "true") {
        await btn.click({ force: true });
        posted = true;
        console.log("✅ Clicked [" + label + "]");
        break;
      }
    }
  }

  // Method 2: Locator text
  if (!posted) {
    try {
      const postBtn = page.locator('div[role="dialog"] div[role="button"]:has-text("Đăng")').last();
      if (await postBtn.count() > 0) {
        await postBtn.click({ force: true });
        posted = true;
        console.log("✅ Clicked via locator");
      }
    } catch {}
  }

  // Method 3: Evaluate - find and click the Đăng button via JS
  if (!posted) {
    posted = await page.evaluate(() => {
      const dialog = document.querySelector('div[role="dialog"]');
      if (!dialog) return false;
      const buttons = dialog.querySelectorAll('div[role="button"]');
      for (const btn of buttons) {
        const text = btn.textContent?.trim();
        const label = btn.getAttribute("aria-label");
        if ((text === "Đăng" || label === "Đăng" || text === "Post" || label === "Post") && btn.getAttribute("aria-disabled") !== "true") {
          (btn as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    if (posted) console.log("✅ Clicked via evaluate");
  }

  // Method 4: Tab to button + Enter
  if (!posted) {
    console.log("⌨️ Trying Tab + Enter...");
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      await delay(200, 400);
    }
    await page.keyboard.press("Enter");
    posted = true;
    console.log("⌨️ Pressed Enter after Tab");
  }

  await delay(6000, 10000);
  await page.screenshot({ path: path.join(LOG_DIR, "v2-after-post-" + BEAT_NUM + ".png") });

  // Check if we're back to profile (posting usually closes dialog)
  const dialogStillOpen = await page.$('div[role="dialog"]');
  if (!dialogStillOpen) {
    console.log("✅ Dialog closed — post likely succeeded!");
  } else {
    console.log("⚠️ Dialog still open — post may have failed");
  }

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
  console.log("🔒 Done");
}
main().catch(console.error);
