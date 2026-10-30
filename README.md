# 🪨 Rock Duel (Đấu Súng 1v1 Nấp Đá)

Game đấu súng đối kháng 1v1 ẩn nấp thời gian thực (Real-time P2P) chạy trực tiếp trên nền web trình duyệt và triển khai dễ dàng qua Vercel.

## 🎯 Luật chơi & Cơ chế cốt lõi
1. **Mỗi người một mạng (1-hit 1-kill):** Trúng một viên đạn là phân định thắng bại ngay lập tức.
2. **Cố định vị trí:** Hai người chơi đứng nấp sau 2 tảng đá tự nhiên, không thể chạy loanh quanh.
3. **Cơ chế ngó đầu 360° bằng chuột (Continuous Mouse Peek):** 
   - Mặc định: Giấu người an toàn 100% sau tảng đá.
   - Di chuyển chuột theo bất kỳ hướng nào (trái, phải, ngẩng lên, góc chéo) để thò đầu ra mép tảng đá quan sát và ngắm bắn đối thủ.
   - Càng thò đầu ra ngoài, góc nhìn càng thoáng nhưng bạn cũng để lộ sơ hở cho đối thủ bắn trúng!
4. **Ngắm & Bắn:**
   - **Chuột Phải:** Bật ống ngắm bắn tỉa (ADS - Zoom 6x, thu nhỏ tâm ngắm).
   - **Chuột Trái:** Bắn đạn (Có thể bắn nhanh từ hông hoặc bắn qua ống ngắm).
   - Chu kỳ lên đạn bolt-action chân thực kèm âm thanh metallic.
5. **3 Cự ly bản đồ (3 Maps):**
   - **Cự ly Gần (18m):** Phản xạ chớp nhoáng, mục tiêu lớn, đấu súng giáp lá cà tốc độ cao.
   - **Cự ly Vừa (35m):** Cân bằng giữa ẩn nấp và ngắm tỉa chuẩn xác.
   - **Cự ly Xa (60m):** Thử thách bắn tỉa tầm xa, mục tiêu nhỏ, đòi hỏi kiên nhẫn.
6. **Chế độ chơi:**
   - **Đấu Online 2 Người:** Kết nối WebRTC Peer-to-Peer (Ping siêu thấp ~15ms, tạo phòng gửi link 1-click).
   - **Luyện tập với Bot AI:** Đấu với Bot nấp đá thông minh để luyện tay trước khi đấu bạn bè.

---

## 🚀 Triển khai lên Vercel (1-Click Deployment)

Dự án được tối ưu 100% cho Vercel:
1. Đăng nhập vào [Vercel](https://vercel.com).
2. Chọn **"Add New..."** -> **"Project"**.
3. Chọn Repository `rock-duel` từ tài khoản GitHub của bạn.
4. Bấm **"Deploy"** (Mọi cài đặt Vite/React đã được cấu hình tự động).
5. Sau 30 giây, bạn sẽ nhận được đường link web trực tiếp để gửi cho bạn bè chơi!

---

## 🛠️ Công nghệ sử dụng
- **React 18 + Vite**
- **Three.js:** Đồ họa 3D Procedural (toàn bộ khối đá, cảnh sa mạc, súng bắn tỉa được tạo bằng toán học 3D, không cần tải file 3D nặng).
- **Web Audio API:** Tổng hợp âm thanh tiếng súng nổ, tiếng đạn nảy đá, tiếng lên đạn trực tiếp từ code JS.
- **PeerJS (WebRTC):** Kết nối P2P thời gian thực giữa 2 trình duyệt mà không cần máy chủ WebSocket đắt tiền.
- **Tailwind CSS + Lucide Icons**
