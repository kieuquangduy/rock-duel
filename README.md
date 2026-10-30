# 🎮 Duel Hub (Rock Duel & Tank Duel 1v1)

Hệ thống game đối kháng 3D 1v1 thời gian thực chạy trực tiếp trên trình duyệt, không cần cài đặt, không cần tải asset nặng và hỗ trợ triển khai 1-click lên Vercel.

Bao gồm 2 chế độ chơi song song có thể chuyển đổi linh hoạt ngay tại sảnh chờ:

---

## 🛡️ Chế độ 1: TANK DUEL (Đấu Chiến Tăng 1v1 Thực Địa)

Mô phỏng điều khiển xe tăng chiến đấu chân thực với hệ thống giáp, máu, động lực học bánh xích và đường đạn pháo 120mm:

1. **Điều khiển xe tăng như thật:**
   - **Phím W / S:** Tăng tốc tiến / Lùi xe tăng (có quán tính động cơ, hộp số D, R, N).
   - **Phím A / D:** Đánh lái xoay thân xe (Pivot turn / quay tại chỗ).
   - Bánh xích và bánh chịu tải xoay động theo tốc độ di chuyển thực tế.
2. **Hệ thống ngắm bắn tháp pháo 360°:**
   - Lia chuột để xoay tháp pháo độc lập với hướng di chuyển của thân xe.
   - Nòng pháo nâng hạ góc bắn (Elevation / Depression).
   - **Chuột Phải:** Bật kính ngắm quang học pháo thủ (ADS 6x) với thước ngắm mil-dot đo khoảng cách.
   - **Chuột Trái:** Bắn pháo 120mm APFSDS có độ rơi đường đạn (Ballistics), khói lửa đầu nòng và giật lùi nòng pháo.
3. **Thanh Máu (Armor HP) & Vị trí hiểm yếu:**
   - Mỗi xe có **1000 HP**.
   - **Giáp trước (Glacis / Mantlet):** Độ nghiêng cao, giảm sát thương (khoảng ~220 HP).
   - **Giáp hông & Tháp pháo:** Sát thương chuẩn (~320 - 340 HP).
   - **Động cơ phía sau (Rear weakspot):** Điểm yếu chí mạng, gây nổ hầm máy (~480 HP).
   - Khi HP về 0: Xe tăng nổ tung, tháp pháo văng khỏi thân xe kèm cột khói lửa.
4. **Địa hình & Vật cản:**
   - Chướng ngại vật bê tông hình răng rồng (Dragon's Teeth), tường gạch phòng thủ, tảng đá tự nhiên để nấp thân xe (hull-down).

---

## 🪨 Chế độ 2: ROCK DUEL (Đấu Súng 1v1 Nấp Đá)

Game đấu súng bắn tỉa 1-hit 1-kill giấu mình sau tảng đá tự nhiên:
1. **Cố định vị trí sau đá:** Không thể di chuyển lung tung, tập trung hoàn toàn vào phản xạ ngắm tỉa.
2. **Cơ chế ngó đầu (Lean/Peek):**
   - Phím **A / D:** Thò người sang trái / phải mép đá.
   - Phím **W / S:** Nhổm cao lên ngó qua gờ đá hoặc thụt sâu xuống nấp.
3. **Bắn tỉa 1-hit 1-kill:**
   - Bắn trúng đầu hoặc thân là phân định thắng bại ngay lập tức.
   - Lên đạn bolt-action chân thực.

---

## ⚡ Công nghệ nổi bật
- **100% Procedural 3D (Three.js):** Toàn bộ mô hình xe tăng, súng, đá, sa mạc được dựng bằng thuật toán hình học toán học, tải trang trong chưa đầy 1 giây!
- **Web Audio API:** Âm thanh pháo tăng gầm rú, tiếng kim loại va đập, nổ tung, nạp đạn được tổng hợp trực tiếp từ code JS.
- **Real-Time Multiplayer (MQTT WebSocket + Reliable ACK Protocol):** Đồng bộ mạng 20Hz siêu mượt, đảm bảo 100% không rớt gói tin phân định thắng bại.
- **Bot AI thông minh:** Cả 2 chế độ đều hỗ trợ luyện tập với Bot AI trước khi rủ bạn bè vào giao đấu.
