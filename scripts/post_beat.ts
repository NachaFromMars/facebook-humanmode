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

const BEAT_NUM = parseInt(process.env.BEAT || "2", 10);

const BEATS: Record<number, {title: string; content: string}> = {
  2: {
    title: "BA CUỘC GỌI NHỠ — Phần 2/9 | Cuộc gọi thứ hai: Hoàng",
    content: `Tôi nhớ rõ. Tối thứ bảy.

Căn hộ thuê ở Bình Thạnh lúc đó. Nhỏ hơn căn hộ bây giờ, nhưng ấm hơn — có cái kệ sách bằng gỗ tôi đóng từ hồi sinh viên, có tấm rèm cửa màu xanh rêu mà tôi mua ở chợ Tân Bình, có cái lò nướng nhỏ trên kệ bếp mà tôi dùng đúng ba lần rồi cất vì ngại dọn. Đời sống một mình nhưng không trống.

Tối thứ bảy — tôi nhớ vì hôm đó tôi định nấu canh chua cá lóc. Mới sáng đi chợ, mua cá, mua me, mua đậu bắp, mua giá. Cá đã làm sạch, nồi nước đang sôi. Tôi đứng trong bếp, tay cầm muỗng, và điện thoại reo.

Màn hình: Hoàng.

Hoàng. Người tôi yêu từ năm hai mươi ba đến năm hai mươi sáu. Ba năm. Chia tay không vì chuyện gì lớn. Chỉ là một ngày anh nói "anh mệt rồi," và tôi nói "em cũng vậy." Xong. Như hai người cùng buông tay một lúc, không ai buông trước.

Sau đó — năm năm. Không liên lạc. Không block, không xóa số, nhưng không nhắn tin, không gọi. Cái kiểu xa của những người không ghét nhau nhưng không biết nói gì nữa.`,
  },
  3: {
    title: "BA CUỘC GỌI NHỠ — Phần 3/9 | Chuông ngừng",
    content: `Chuông reo lần ba. Lần bốn.

Tôi nhìn tên anh trên màn hình và nghĩ: Nếu bắt máy thì nói gì? "Anh khỏe không?" — xong rồi sao? "Lâu rồi không gặp" — rồi sao? Mỗi câu tôi nghĩ ra đều dẫn đến một chỗ mà tôi không muốn tới. Không phải chỗ đau — chỗ không biết.

Tôi sợ. Không phải sợ Hoàng. Sợ cái "sau khi bắt máy." Sợ nghe giọng anh rồi không biết mình là ai — người yêu cũ, bạn cũ, hay người lạ có chung ký ức.

Chuông ngừng. Cuộc gọi nhỡ. 19:42. Ba mươi giây.

Tôi đứng trong bếp. Nồi canh chua sôi. Hơi nước bay lên. Nấu xong. Ăn một mình. Ngon. Nhưng nhớ vì trong lúc ăn, tôi liên tục nhìn điện thoại. Cái im lặng của điện thoại sau cuộc gọi nhỡ — nó khác cái im lặng bình thường. Nó nặng hơn. Như có người đứng ngoài cửa, gõ một lần, rồi bỏ đi.

Ba tháng sau, tôi tình cờ thấy Instagram anh. Anh cưới. Cô khác. Tôi nhìn lâu. Không đau. Chỉ là một khoảng trống. Như cái ghế trống bên bàn ăn mà tôi đã quen không nhìn.

Và cái "không bao giờ biết" đó — nó sống trong tôi dai hơn bất cứ câu trả lời nào.`,
  },
};

const HASHTAGS = "#TieuTam #nho #ai #BaCuocGoiNho #truyen #vanviet #saigon #cuocsong #yeununhothigoingay";

function getRandomImage(): string {
  const files = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  return path.join(ALBUM_DIR, files[Math.floor(Math.random() * files.length)]);
}

async function main() {
  const beat = BEATS[BEAT_NUM];
  if (!beat) { console.log("❌ Beat not found: " + BEAT_NUM); return; }

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

  // Go to profile
  await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(5000, 7000);

  if (page.url().includes("login")) { console.log("❌ Cookies expired!"); await browser.close(); return; }

  // Scroll to trigger composer
  await page.evaluate(() => { window.scrollBy(0, 300); });
  await delay(1000, 2000);
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await delay(2000, 3000);

  // Click "Bạn đang nghĩ gì?"
  console.log("🖱️ Looking for post composer...");
  let clicked = false;

  // Method 1: locator
  try {
    const loc = page.locator('text=Bạn đang nghĩ gì');
    if (await loc.count() > 0) {
      await loc.first().click();
      clicked = true;
      console.log("  ✅ Clicked via locator");
    }
  } catch {}

  // Method 2: evaluate click
  if (!clicked) {
    clicked = await page.evaluate(() => {
      const spans = document.querySelectorAll("span");
      for (const s of spans) {
        if (s.textContent && s.textContent.includes("Bạn đang nghĩ gì")) {
          (s as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    if (clicked) console.log("  ✅ Clicked via evaluate");
  }

  if (!clicked) {
    console.log("  ❌ Cannot find composer");
    await page.screenshot({ path: path.join(LOG_DIR, "beat-" + BEAT_NUM + "-no-composer.png") });
    await browser.close();
    return;
  }

  await delay(3000, 5000);

  // Find textbox in dialog
  const textbox = await page.$('div[role="dialog"] div[role="textbox"][contenteditable="true"]');
  if (!textbox) {
    // Try any visible textbox
    const alt = await page.$('div[role="textbox"][contenteditable="true"]');
    if (!alt) {
      console.log("  ❌ No textbox in dialog");
      await page.screenshot({ path: path.join(LOG_DIR, "beat-" + BEAT_NUM + "-no-textbox.png") });
      await browser.close();
      return;
    }
  }

  const tb = textbox || await page.$('div[role="textbox"][contenteditable="true"]');
  if (!tb) { await browser.close(); return; }

  await tb.click();
  await delay(500, 1000);

  const fullText = beat.title + "\n\n" + beat.content + "\n\n" + HASHTAGS;
  await page.keyboard.insertText(fullText);
  console.log("  ✍️ Text inserted (" + fullText.length + " chars)");
  await delay(1000, 2000);

  // Try attach image
  const imgPath = getRandomImage();
  try {
    const photoBtn = await page.$('div[role="dialog"] div[aria-label*="Ảnh"], div[role="dialog"] div[aria-label*="Photo"]');
    if (photoBtn) {
      await photoBtn.click();
      await delay(1000, 2000);
    }
    const fileInput = await page.$('input[type="file"][accept*="image"]');
    if (fileInput) {
      await fileInput.setInputFiles(imgPath);
      console.log("  📷 Attached: " + path.basename(imgPath));
      await delay(3000, 5000);
    }
  } catch (e: any) {
    console.log("  ⚠️ Image: " + (e.message || "").substring(0, 50));
  }

  // Click Post button
  await delay(1000, 2000);
  let posted = false;
  const postSelectors = [
    'div[role="dialog"] div[role="button"][aria-label="Đăng"]',
    'div[role="dialog"] div[role="button"][aria-label="Post"]',
  ];
  for (const sel of postSelectors) {
    const btn = await page.$(sel);
    if (btn) {
      await btn.click();
      posted = true;
      console.log("  ✅ Clicked Post button");
      break;
    }
  }

  if (!posted) {
    // Try locator
    try {
      const postLoc = page.locator('div[role="dialog"] div[role="button"]:has-text("Đăng")');
      if (await postLoc.count() > 0) {
        await postLoc.first().click();
        posted = true;
        console.log("  ✅ Clicked via locator");
      }
    } catch {}
  }

  await delay(5000, 8000);
  await page.screenshot({ path: path.join(LOG_DIR, "beat-" + BEAT_NUM + "-posted.png") });
  console.log(posted ? "✅ Beat " + BEAT_NUM + " POSTED!" : "❌ Could not post");

  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));
  await browser.close();
}
main().catch(console.error);
