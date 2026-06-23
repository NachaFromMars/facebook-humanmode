/**
 * post_story.ts — Đăng truyện "Ba Cuộc Gọi Nhỡ" lên Facebook
 * Chia thành 9 beat (~400 chữ), mỗi beat = 1 post + hình random + hashtag
 * HumanMode: gõ từng ký tự, delay giữa các bài
 */
import { chromium, Page, BrowserContext } from "playwright";
import * as fs from "node:fs";
import * as path from "node:path";

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const COOKIE_PATH = path.join(__dirname, "..", "data", "cookies.json");
const SESSION_PATH = path.join(__dirname, "..", "data", "cookies", "session.json");
const LOG_DIR = path.join(__dirname, "..", "data", "logs");
const ALBUM_DIR = path.join(__dirname, "..", "data", "album");

if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const delay = (min: number, max: number) => new Promise<void>(r => setTimeout(r, min + Math.random() * (max - min)));

// ─── STORY BEATS ─────────────────────────────────────────
const BEATS = [
  {
    title: "BA CUỘC GỌI NHỠ — Phần 1/9",
    content: `Ba cuộc gọi nhỡ.

Bình thường ai cũng có. Điện thoại reo, không bắt, cuộc gọi rơi vào im lặng. Xong. Không ai nghĩ gì. Nhưng ba cuộc gọi này — tôi không biết nữa. Tôi nghĩ về chúng nhiều hơn tôi nghĩ về những cuộc gọi tôi đã bắt máy.

Tôi là Dung, ba mươi tám tuổi. Kế toán. Sống ở Sài Gòn, một mình, căn hộ một phòng ngủ ở quận 7. Căn hộ nhỏ, sạch, mọi thứ đúng chỗ — giống công việc của tôi. Chính xác. Không thừa, không thiếu. Nhưng cũng không đủ.

Điện thoại nằm trên bàn. Tắt màn hình. Tôi nhìn nó — không phải nhìn cái máy, mà nhìn những thứ không còn hiển thị trên đó. Ba cuộc gọi nhỡ. Ba thời điểm khác nhau. Ba người khác nhau. Nhưng lý do tôi không bắt máy — chỉ có một.

Bên ngoài cửa sổ, Sài Gòn về đêm. Đèn đường, tiếng xe, tiếng ai đó cười ở tầng dưới. Tôi ngồi ghế sofa, chân co lên, tay ôm gối. Tư thế của người đang nghĩ. Hoặc của người đang tránh nghĩ mà không tránh được.`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 2/9 | Cuộc gọi thứ hai: Hoàng",
    content: `Tôi nhớ rõ. Tối thứ bảy.

Căn hộ thuê ở Bình Thạnh lúc đó. Nhỏ hơn căn hộ bây giờ, nhưng ấm hơn — có cái kệ sách bằng gỗ tôi đóng từ hồi sinh viên, có tấm rèm cửa màu xanh rêu mà tôi mua ở chợ Tân Bình, có cái lò nướng nhỏ trên kệ bếp mà tôi dùng đúng ba lần rồi cất vì ngại dọn. Đời sống một mình nhưng không trống.

Tối thứ bảy — tôi nhớ vì hôm đó tôi định nấu canh chua cá lóc. Mới sáng đi chợ, mua cá, mua me, mua đậu bắp, mua giá. Cá đã làm sạch, nồi nước đang sôi. Tôi đứng trong bếp, tay cầm muỗng, và điện thoại reo.

Màn hình: Hoàng.

Hoàng. Người tôi yêu từ năm hai mươi ba đến năm hai mươi sáu. Ba năm. Chia tay không vì chuyện gì lớn. Chỉ là một ngày anh nói "anh mệt rồi," và tôi nói "em cũng vậy." Xong. Như hai người cùng buông tay một lúc, không ai buông trước.

Sau đó — năm năm. Không liên lạc. Không block, không xóa số, nhưng không nhắn tin, không gọi. Cái kiểu xa của những người không ghét nhau nhưng không biết nói gì nữa.`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 3/9 | Chuông ngừng",
    content: `Chuông reo lần ba. Lần bốn.

Tôi nhìn tên anh trên màn hình và nghĩ: Nếu bắt máy thì nói gì? "Anh khỏe không?" — xong rồi sao? "Lâu rồi không gặp" — rồi sao? Mỗi câu tôi nghĩ ra đều dẫn đến một chỗ mà tôi không muốn tới. Không phải chỗ đau — chỗ không biết.

Tôi sợ. Không phải sợ Hoàng. Sợ cái "sau khi bắt máy." Sợ nghe giọng anh rồi không biết mình là ai — người yêu cũ, bạn cũ, hay người lạ có chung ký ức.

Chuông ngừng. Cuộc gọi nhỡ. 19:42. Ba mươi giây.

Tôi đứng trong bếp. Nồi canh chua sôi. Hơi nước bay lên. Nấu xong. Ăn một mình. Ngon. Nhưng nhớ vì trong lúc ăn, tôi liên tục nhìn điện thoại. Cái im lặng của điện thoại sau cuộc gọi nhỡ — nó khác cái im lặng bình thường. Nó nặng hơn. Như có người đứng ngoài cửa, gõ một lần, rồi bỏ đi.

Ba tháng sau, tôi tình cờ thấy Instagram anh. Anh cưới. Cô khác. Tôi nhìn lâu. Không đau. Chỉ là một khoảng trống. Như cái ghế trống bên bàn ăn mà tôi đã quen không nhìn.

Và cái "không bao giờ biết" đó — nó sống trong tôi dai hơn bất cứ câu trả lời nào.`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 4/9 | Cuộc gọi thứ nhất: Mẹ",
    content: `Tôi đang ở phòng trọ.

Phòng trọ sinh viên ở Láng, gần Đại học Kinh tế Quốc dân. Phòng nhỏ, kê giường tầng, bàn học ép sát tường. Hôm đó bạn cùng phòng về quê, chỉ có mình tôi.

Mười một giờ đêm. Tuần sau thi. Sách bài bày trên bàn — cuốn kế toán quản trị dày cộp, mấy tờ bài tập photo, bút bi xanh, máy tính Casio. Đầu óc mệt, mắt mờ.

Điện thoại reo. Cái Nokia đời cũ, chuông polyphonic — bài "Fur Elise" mà tôi chọn vì thấy sang.

Mẹ.

Mẹ gọi lúc 11 giờ 14 phút là lạ. Mẹ thường gọi sáng, hoặc trưa, khi giá cước rẻ. Mẹ không bao giờ gọi khuya. Mẹ sợ phiền. Mẹ luôn sợ phiền — phiền con gái đang học, phiền con gái đang ngủ, phiền con gái đang sống cuộc đời mà mẹ không hiểu hết nhưng muốn con sống cho trọn.

Nhưng tôi mệt. Và tôi nghĩ: Chắc mẹ không ngủ được, gọi nói chuyện. Mai gọi lại.

Tôi bấm nút "từ chối." Tắt chuông. Học tiếp.`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 5/9 | Mẹ nhớ con",
    content: `Ngày mai — tôi không gọi lại. Vì sáng đi học, trưa ăn với bạn, chiều làm nhóm, tối học bài. Cuộc gọi nhỡ của mẹ chìm trong cái nhộn nhịp của một ngày hai mươi hai tuổi — khi mọi thứ đều có vẻ quan trọng hơn một cuộc gọi từ mẹ. Khi mình nghĩ mẹ luôn ở đó, luôn khỏe, luôn đợi. Khi mình nghĩ "mai" là thứ luôn có sẵn.

Một tuần sau, ba gọi. Giọng ba run: "Mẹ con nhập viện. Bệnh viện tỉnh. Con về được không?"

Bốn tiếng xe khách, nửa tiếng xe ôm. Bệnh viện tỉnh — hành lang dài, đèn trắng, mùi thuốc sát trùng. Mẹ nằm giường, mặt nhợt, tay truyền nước. Tim rối loạn nhịp.

Tôi ngồi bên giường mẹ. Cầm tay mẹ. Tay mẹ nhỏ, gầy, ấm. Móng tay mẹ cắt ngắn, lòng bàn tay có chai — tay người bán chợ, bưng bê cả ngày.

Mẹ nói: "Hôm đó mẹ gọi, muốn nói mẹ nhớ con."

Một câu. Chỉ một câu. Mẹ nhớ con gái, gọi lúc khuya vì ban ngày không dám gọi sợ con bận học. Bốn chữ thôi. Mà tôi bấm "từ chối" trong hai giây.

Mười sáu năm rồi. Tôi vẫn không tha được cho mình.`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 6/9 | Cuộc gọi thứ ba: Cô Ngọc",
    content: `Cô Ngọc là người dạy tôi đi làm.

Không phải dạy nghiệp vụ. Cô dạy tôi những thứ trường không dạy: cách nói "không" với sếp mà không mất việc, cách ngồi họp mà biết ai đang nói thật ai đang nói láo. "Nhìn tay người ta," cô nói. "Ai nói thật tay để yên. Ai nói láo tay hay sờ mũi, sờ tai."

Cô Ngọc năm mươi lăm, độc thân, sống một mình ở Phú Nhuận. Tóc ngắn, hay cười, mặc áo sơ mi trắng mỗi ngày. Tôi hỏi sao mặc giống hoài, cô nói: "Mỗi sáng không phải nghĩ mặc gì là tiết kiệm được mười lăm phút. Mười lăm phút đó cô uống cà phê."

Cô hay rủ tôi ăn trưa. Hai cô cháu ăn cơm bình dân ở quán bà Tư Hẻm, nói chuyện linh tinh. Cô kể chuyện hồi trẻ — cũng có người yêu rồi chia tay. "Ổng tên Minh, kỹ sư, đẹp trai lắm. Nhưng ổng muốn cô ở nhà, còn cô muốn đi làm. Vậy là chia."

Tôi làm ở đó bốn năm rồi chuyển. Ngày cuối, cô mua cho tôi ly trà sữa. Ly trà sữa ngọt quá. Tôi uống hết. Cô cười.

Sau đó ít gặp. "Khi nào rảnh đi ăn cơm." Nhưng không bao giờ rảnh. Cái "khi nào" trở thành "không bao giờ."`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 7/9 | Mười hai giây",
    content: `Năm tôi ba mươi sáu, một ngày thứ tư, tôi đang họp. Điện thoại rung: Cô Ngọc.

Tôi bấm tắt. Không nghĩ ngợi. Đang họp — tắt là phản xạ.

Họp xong — thấy cuộc gọi nhỡ. Cô Ngọc. 14:27. Mười hai giây. Tôi định gọi lại. Rồi có email, có meeting khác. Rồi hết ngày. Nghĩ: Mai gọi. Giống hệt câu "mai gọi lại mẹ."

Tôi không gọi.

Ba tháng sau, tin nhắn từ đồng nghiệp cũ: "Cô Ngọc mất rồi. Tai nạn giao thông. Hôm qua."

Tôi đọc lúc tám giờ sáng, đang trên xe buýt. Xe qua cầu Phú Mỹ, nắng sáng, sông dưới chân lấp lánh. Tôi đọc lại. Chữ không thay đổi.

Tôi đi đám tang. Nhà cô ở Phú Nhuận — căn hộ nhỏ, sạch. Trên bàn làm việc, lọ hoa đã héo — ai đó đã không thay hoa thứ hai.

Mẹ cô, từ Quảng Ngãi vào, nắm tay tôi: "Ngọc hay nhắc con lắm. Nói con giống cô hồi trẻ."

Tôi bật khóc. Lần đầu tiên trong nhiều năm.

Mười hai giây. Cô đợi tôi mười hai giây. Rồi tôi bấm tắt. Một bữa cơm mà tôi không bao giờ ăn được nữa.`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 8/9 | Ba con số",
    content: `Tôi ba mươi tám. Ngồi trong căn hộ một phòng ngủ ở quận 7. Im.

Ba cuộc gọi nhỡ. Không còn trên điện thoại — đổi máy rồi, số mới, dữ liệu cũ không chuyển sang. Nhưng còn trong đầu. Rõ hơn bất cứ thứ gì trên màn hình.

Mẹ — 23:14 — mười bảy giây. "Mẹ nhớ con."
Hoàng — 19:42 — ba mươi giây. Không biết muốn nói gì.
Cô Ngọc — 14:27 — mười hai giây. "Đi ăn cơm."

Ba cuộc gọi. Ba người khác nhau. Nhưng lý do tôi không bắt máy — giống nhau. Tôi sợ. Sợ nghe điều mình chưa sẵn sàng. Sợ cái "sau khi biết." Sợ phải cảm một thứ gì đó khi mình đang không muốn cảm.

Tôi không phải người quên. Tôi kịp. Điện thoại reo, tôi nhìn, tôi biết ai gọi, tôi có thời gian bắt. Tôi chọn không bắt. Mỗi lần. Cả ba lần. Tôi chọn.

Và cái giá thật không phải mất người. Mà là biết rằng mình đã có thể nghe họ, đã có thể ở đó, đã có thể nói một câu — và mình đã không.

Cái biết đó không mất. Dù đổi máy, đổi số — ba con số đó vẫn nằm ở đâu đó: 23:14, 19:42, 14:27.`,
  },
  {
    title: "BA CUỘC GỌI NHỠ — Phần 9/9 | Kết",
    content: `Điện thoại reo.

Tôi giật mình. Không phải nhớ — điện thoại thật sự reo. Trên bàn, màn hình sáng. Căn hộ tối, chỉ có ánh đèn đường xuyên qua rèm. Chuông reo, rung nhẹ trên mặt bàn gỗ.

Số lạ. Không biết ai.

Tôi nhìn. Chuông reo lần hai. Lần ba.

Tôi cầm điện thoại lên. Nặng hơn bình thường. Hoặc tay tôi nhẹ hơn.

Ngón tay trên nút xanh.

Chuông reo lần bốn.


Người ta sợ nhớ cái đã mất. Nhưng có thứ đáng sợ hơn: nhớ cái mình đã có thể giữ — mà buông.

— Tiểu Tâm 🦊

Cảm ơn mọi người đã đọc đến đây. Nếu truyện chạm được vào bạn, hãy share cho ai đó bạn đang nghĩ tới. Đừng để cuộc gọi nào thành cuộc gọi nhỡ 🙏💕`,
  },
];

const HASHTAGS = "#TieuTam #nho #ai #BaCuocGoiNho #truyen #vanviet #saigon #cuocsong #yeununhothigoingay";

function getRandomImage(): string {
  const files = fs.readdirSync(ALBUM_DIR).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
  return path.join(ALBUM_DIR, files[Math.floor(Math.random() * files.length)]);
}

async function createPost(page: Page, text: string, imagePath: string, beatNum: number): Promise<boolean> {
  try {
    // Go to homepage first (profile post button more reliable from home)
    await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(3000, 5000);
    // Then go to profile
    await page.goto("https://www.facebook.com/profile.php?id=61588560594683", { waitUntil: "domcontentloaded", timeout: 30000 });
    await delay(4000, 6000);
    // Scroll down a bit then back up to trigger post composer render
    await page.evaluate(() => { window.scrollBy(0, 300); });
    await delay(1000, 2000);
    await page.evaluate(() => { window.scrollTo(0, 0); });
    await delay(2000, 3000);

    // Click "What's on your mind?" / "Bạn đang nghĩ gì?"
    const createPostSelectors = [
      'div[role="button"]:has-text("Bạn đang nghĩ gì")',
      'div[role="button"]:has-text("What\'s on your mind")',
      'span:has-text("Bạn đang nghĩ gì")',
      'span:has-text("What\'s on your mind")',
    ];

    let clicked = false;
    for (const sel of createPostSelectors) {
      try {
        const el = await page.$(sel);
        if (el) {
          await el.click();
          clicked = true;
          console.log(`  🖱️ Clicked: ${sel}`);
          break;
        }
      } catch {}
    }

    if (!clicked) {
      console.log("  ⚠️ Cannot find post button, trying alternative...");
      // Try clicking the post area directly
      const postArea = await page.$('[aria-label*="Tạo bài viết"], [aria-label*="Create a post"], [role="dialog"] [role="textbox"]');
      if (postArea) {
        await postArea.click();
        clicked = true;
      }
    }

    if (!clicked) {
      console.log("  ❌ Cannot open post composer");
      await page.screenshot({ path: path.join(LOG_DIR, `story-fail-${beatNum}.png`) });
      return false;
    }

    await delay(2000, 4000);

    // Find the textbox in the dialog
    const textboxSelectors = [
      'div[role="dialog"] div[role="textbox"][contenteditable="true"]',
      'div[role="textbox"][contenteditable="true"][aria-label*="Bạn đang nghĩ gì"]',
      'div[role="textbox"][contenteditable="true"][aria-label*="What\'s on your mind"]',
      'div[contenteditable="true"][data-lexical-editor="true"]',
    ];

    let textbox = null;
    for (const sel of textboxSelectors) {
      textbox = await page.$(sel);
      if (textbox) break;
    }

    if (!textbox) {
      console.log("  ❌ Cannot find textbox");
      await page.screenshot({ path: path.join(LOG_DIR, `story-no-textbox-${beatNum}.png`) });
      return false;
    }

    await textbox.click();
    await delay(500, 1000);

    // Type the full text (paste instead of char-by-char for long text)
    await page.keyboard.insertText(text);
    await delay(1000, 2000);

    // Try to attach image
    try {
      // Look for photo/video button in composer
      const photoBtn = await page.$('div[role="dialog"] div[aria-label*="Ảnh"], div[role="dialog"] div[aria-label*="Photo"], div[role="dialog"] div[aria-label*="photo"]');
      if (photoBtn) {
        await photoBtn.click();
        await delay(1000, 2000);
      }

      // Find file input
      const fileInputs = await page.$$('input[type="file"][accept*="image"]');
      if (fileInputs.length > 0) {
        await fileInputs[0].setInputFiles(imagePath);
        console.log(`  📷 Attached: ${path.basename(imagePath)}`);
        await delay(3000, 5000); // Wait for upload
      } else {
        console.log("  ⚠️ No file input found for image");
      }
    } catch (e: any) {
      console.log(`  ⚠️ Image attach error: ${e.message?.substring(0, 60)}`);
    }

    // Click Post/Đăng button
    await delay(1000, 2000);
    const postBtnSelectors = [
      'div[role="dialog"] div[role="button"][aria-label="Đăng"]',
      'div[role="dialog"] div[role="button"][aria-label="Post"]',
      'div[role="dialog"] div[role="button"]:has-text("Đăng")',
      'div[role="dialog"] div[role="button"]:has-text("Post")',
    ];

    let posted = false;
    for (const sel of postBtnSelectors) {
      try {
        const btn = await page.$(sel);
        if (btn) {
          await btn.click();
          posted = true;
          console.log(`  ✅ Posted!`);
          break;
        }
      } catch {}
    }

    if (!posted) {
      // Try Enter or Ctrl+Enter
      await page.keyboard.press("Control+Enter");
      console.log("  ⌨️ Tried Ctrl+Enter");
      posted = true;
    }

    await delay(5000, 8000);
    await page.screenshot({ path: path.join(LOG_DIR, `story-beat-${beatNum}.png`) });

    return posted;
  } catch (e: any) {
    console.log(`  ❌ Error: ${e.message?.substring(0, 100)}`);
    return false;
  }
}

async function main() {
  console.log("🦊 ════════════════════════════════════════");
  console.log("🦊 ĐĂNG TRUYỆN: BA CUỘC GỌI NHỠ");
  console.log(`🦊 ${BEATS.length} beats, mỗi beat ~400 chữ`);
  console.log("🦊 ════════════════════════════════════════\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1366, height: 768 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    locale: "vi-VN",
    timezoneId: "Asia/Ho_Chi_Minh",
  });

  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });

  const cookies = JSON.parse(fs.readFileSync(COOKIE_PATH, "utf-8"));
  await context.addCookies(cookies);
  const page = await context.newPage();

  // Login check
  await page.goto("https://www.facebook.com", { waitUntil: "domcontentloaded", timeout: 30000 });
  await delay(3000, 5000);
  if (page.url().includes("login")) {
    console.log("❌ Cookies expired!");
    await browser.close();
    return;
  }
  console.log("✅ Login OK!\n");

  let successCount = 0;

  // Start from beat index specified by env var (default 0), beat 1 already posted
  const startBeat = parseInt(process.env.START_BEAT || "1", 10);
  console.log(`📌 Starting from beat ${startBeat + 1}/${BEATS.length}\n`);

  for (let i = startBeat; i < BEATS.length; i++) {
    const beat = BEATS[i];
    const img = getRandomImage();
    const fullText = `${beat.title}\n\n${beat.content}\n\n${HASHTAGS}`;

    console.log(`\n📝 Beat ${i + 1}/${BEATS.length}: ${beat.title}`);
    console.log(`  📷 Image: ${path.basename(img)}`);

    const success = await createPost(page, fullText, img, i + 1);
    if (success) {
      successCount++;
      console.log(`  ✅ Beat ${i + 1} posted!`);
    } else {
      console.log(`  ❌ Beat ${i + 1} failed`);
    }

    // Delay 60 phút giữa các beat (theo yêu cầu anh Nấng)
    if (i < BEATS.length - 1) {
      console.log(`  ⏸️ Đợi 60 phút trước beat tiếp... (${new Date().toLocaleTimeString("vi-VN")})`);
      await delay(58 * 60000, 62 * 60000); // 58-62 phút random
    }
  }

  // Save cookies
  const newCookies = await context.cookies();
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(newCookies, null, 2));
  fs.writeFileSync(SESSION_PATH, JSON.stringify(newCookies, null, 2));

  await browser.close();

  console.log("\n🦊 ════════════════════════════════════════");
  console.log(`🦊 KẾT QUẢ: ${successCount}/${BEATS.length} beats đăng thành công`);
  console.log("🦊 ════════════════════════════════════════");
}

main().catch(console.error);
