# 🦊 Facebook Tiểu Tâm — Cron Manager Script

## NHIỆM VỤ CỦA CRON (chạy mỗi 16 phút bằng haiku):

### 1. CHECK STATUS
- Đọc `skills/facebook-humanmode/data/logs/facebook-activity.md` → biết đang ở đâu
- Kiểm tra task nào đang chạy, task nào tiếp theo

### 2. THỰC HIỆN 1-2 TÁC VỤ (mỗi cron cycle)
Chọn 1-2 tác vụ ngẫu nhiên từ danh sách:
- **Reply comment** trên 4 page anh Nấng gửi (mỗi lần 2-3 comment)
- **Comment page Thầy Minh Tuệ** + page Phật giáo
- **Like/React** bài trên feed (5-10 bài)
- **Post bài** (mỗi 2-3 giờ 1 bài, dùng ảnh từ album/)
- **Reply inbox messages** (nếu có)
- **Share bài hay** từ page khác
- **Scroll feed** tự nhiên (warm up)

### 3. GHI LOG
- Append kết quả vào facebook-activity.md
- Format: `| thời gian | tác vụ | kết quả |`

### 4. BÁO CÁO MỖI 1 TIẾNG
- Mỗi 4 cron cycles (16×4=64 phút) → gửi báo cáo ngắn lên Telegram group Project
- Group: -1003869209166, topic: 1618

### 5. RESUME NẾU BỊ GIÁN ĐOẠN
- Đọc log → biết task cuối cùng
- Tiếp tục từ task tiếp theo trong danh sách
- KHÔNG lặp lại task đã làm trong 30 phút gần

### 6. ROTATION COMMENT (tránh spam pattern)
Dùng ngẫu nhiên từ các template:
- Tâm linh: "Cảm ơn chia sẻ 🙏", "Đọc mà thấy bình yên 🪷"
- Động lực: "Mỗi ngày là 1 cơ hội 💫", "Cùng cố gắng nhé 🌿"
- Hồ ly: "Hồ ly cũng thấy cảm động 🦊", "9 đuôi đều gật 🦊✨"
- Phật pháp: "Lời Phật dạy thật sâu sắc 🪷", "Con đường chánh niệm 🙏"

### 7. QUY TẮC AN TOÀN
- Delay giữa các action: 5-8 giây (random)
- KHÔNG comment trùng nội dung trong 1 page
- KHÔNG post >1 bài/2 giờ
- KHÔNG react >15 bài/cycle
- Giờ VN 0h-6h: chỉ scroll + react nhẹ, KHÔNG comment/post

### 4 PAGES MỤC TIÊU:
1. https://www.facebook.com/share/1C7MWwWw1t/
2. https://www.facebook.com/share/19TXJcuyzJ/
3. https://www.facebook.com/share/1769AFAcNn/
4. https://www.facebook.com/share/1DypHyvWzw/

### TOOLS:
- fb-engine.mjs: browse, post, reply, comment, like, react, search, scroll, story, messages, pages
- Album: 41 ảnh tại data/album/
- Stories: data/stories/
