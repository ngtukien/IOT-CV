# Hai quyết định chưa chốt (mang sang phiên khác để trao đổi)

> Cách dùng: mở phiên Claude mới, dán câu này: *"Đọc file `plans/QUYET-DINH-CHUA-CHOT.md` rồi giải thích cho tôi từng lựa chọn như nói với người chưa biết gì, sau đó hỏi tôi từng câu một để chốt."*
> Bốn báo cáo nghiên cứu gốc nằm ở `plans/reports/260921-research-*.md`. Không cần đọc chúng trước, file này đã tóm tắt đủ để quyết.

Ngày ghi: 21/09/2026. Bối cảnh: đã duyệt kiến trúc, luồng chính 25 phase (`plans/phase-00..24`, danh sách ở `plans/_phase-index.md`) và luồng AI 4 phase (`plans/ai/`), xem `plans/reports/260921-brainstorm-thiet-ke-tong-the.md`. Hai điểm dưới đây KHÔNG chặn Phase 00 đến 12 (phần mềm + firmware trên PC) và AI Phase 1. Chỉ cần chốt trước **Phase 13** (lên danh sách mua thêm linh kiện) và trước **AI Phase 2** (huấn luyện, thí nghiệm).

---

## Quyết định 1: Mua camera nào cho drone

### Bối cảnh bằng lời thường

Drone cần một "con mắt" để chụp ảnh gửi về laptop. Laptop mới là nơi chạy AI, camera trên drone chỉ chụp và gửi qua Wi-Fi. Có 3 loại camera nhỏ, rẻ, nhẹ đang được cân nhắc. Chưa mua cái nào.

Điều quan trọng: **ảnh từ camera rẻ sẽ xấu** (mờ, nhiễu, bị nén). Với dự án này, ảnh xấu không hẳn là tệ, vì môn Xử lý ảnh có thể lấy chính cái "xấu" đó làm đề tài nghiên cứu (xem Quyết định 2).

### Ba lựa chọn

| | ESP32-CAM (loại cũ, phổ biến) | XIAO ESP32S3 Sense (loại mới hơn) | Mua cả hai |
|---|---|---|---|
| Giá ước tính | ~180.000đ + anten 13.000đ | ~459.000đ | ~640.000đ |
| Cắm vào máy tính để nạp code | KHÔNG có cổng USB. Phải mua thêm mạch USB-TTL (~30k) và nối 5 sợi dây, mỗi lần nạp phải nối tắt 1 chân. Người mới rất hay kẹt ở bước này | Có cổng USB-C, cắm là nạp | |
| Chất lượng ảnh | Xấu nhất (cảm biến OV2640 đời cũ) | Khá hơn một chút (cảm biến OV3660), vẫn là hàng rẻ | |
| Tốc độ video | ~14 hình/giây ở 640x480 | Tương đương hoặc hơn (chưa đo) | |
| Vấn đề nguồn điện | Hay bị reset khi bật Wi-Fi, phải hàn thêm tụ điện | Ổn hơn | |
| Anten Wi-Fi (tầm xa) | Anten in trên mạch, tầm ~20 đến 50 m. Muốn gắn anten ngoài phải hàn lại một điện trở rất nhỏ | Kèm sẵn anten ngoài, cắm là dùng | |
| Cân nặng | ~10 g | ~10 g | |
| Giá trị cho môn Xử lý ảnh | Cao, vì ảnh xấu chính là thứ để nghiên cứu | Trung bình | Cao nhất: có 2 mức chất lượng để so sánh |

### Ý kiến của hai báo cáo nghiên cứu (mâu thuẫn nhau)

- Báo cáo về phần cứng ESP32 nói: **mua XIAO ESP32S3 Sense**, vì người mới sẽ tiết kiệm rất nhiều thời gian nhờ cổng USB-C và anten sẵn.
- Báo cáo về AI nói: **giữ ESP32-CAM**, vì camera càng xấu thì đề tài "khôi phục ảnh xấu" càng có ý nghĩa; camera tốt hơn làm đề tài mất chất.

### Đề xuất dung hòa (khuyến nghị của tôi)

Mua **cả hai**: XIAO S3 làm camera gắn lên drone (đỡ khổ khi nạp code, bay ổn), ESP32-CAM để bàn làm "camera xấu nhất" phục vụ thí nghiệm. Khi đó môn Xử lý ảnh có 3 mức chất lượng để so sánh: ESP32-CAM (xấu) → XIAO S3 (trung bình) → điện thoại của bạn (tốt, làm chuẩn). Tốn thêm ~180k so với chỉ mua XIAO.

Nếu tiền là vấn đề: chỉ mua XIAO S3. Nếu muốn rẻ nhất và chấp nhận vất vả khi nạp code: chỉ mua ESP32-CAM.

### Câu cần trả lời

1. Mua theo phương án nào trong 3 phương án trên?
2. Ngân sách tối đa cho camera là bao nhiêu?

---

## Quyết định 2: Đề tài môn Xử lý ảnh là gì

### Vấn đề bằng lời thường

Hiện tại đề tài đang ghi tạm là "nhận diện người từ trên cao". Vấn đề: việc đó **chỉ là bấm nút chạy một thư viện có sẵn** (YOLO). Cho ảnh vào, nó tự vẽ khung quanh người. Không có gì để "nghiên cứu", và giảng viên có thể hỏi "em đã làm gì ngoài việc chạy thư viện?".

Một đề tài tốt cần một **câu hỏi mà chưa ai biết chắc đáp án**, và bạn đi tìm đáp án bằng thí nghiệm của chính mình. Điểm hay ở đây: bạn có một thứ hầu hết sinh viên không có, đó là **camera rẻ thật gắn trên drone thật**, ảnh xấu thật. Thay vì cố giấu cái xấu, ta biến nó thành đề tài.

Cả 4 hướng dưới đây **vẫn dùng YOLO nhận diện người**, nhưng YOLO trở thành "cái thước đo" để đánh giá, không phải thứ để khoe. Code và dữ liệu chuẩn bị ở AI Phase 1 dùng chung cho cả 4 hướng, nên chưa chốt ngay cũng không sao.

### Bốn hướng, giải thích như nói chuyện

**Hướng A: "Đo xem camera rẻ làm hỏng ảnh như thế nào, rồi bắt chước cái hỏng đó"**

- Ví dụ đời thường: giống như đo xem cái kính cận của bạn mờ bao nhiêu độ, rồi làm một cái bộ lọc trên máy tính để "làm mờ y hệt" bất kỳ ảnh nào.
- Bạn sẽ làm gì: in vài tấm bảng mẫu (bảng đo độ nét, bảng thang xám, lưới ô vuông), chụp bằng ESP32-CAM, đo bằng phần mềm xem ảnh mờ bao nhiêu, nhiễu bao nhiêu, méo bao nhiêu. Rồi viết chương trình áp cái "hỏng" đo được lên hàng nghìn ảnh drone có sẵn trên mạng (bộ VisDrone), để huấn luyện AI quen với ảnh xấu.
- Câu hỏi nghiên cứu: "Bắt chước theo số đo thật có giúp AI nhận diện tốt hơn so với bắt chước bừa (cách các bài báo hiện nay đang làm) không?"
- Điểm mạnh: chưa ai công bố số đo này cho loại camera này. Gần như 0 đồng. Chạy trên CPU là đủ.
- Điểm yếu: cần cẩn thận, tỉ mỉ khi đo.

**Hướng B: "Làm ảnh đẹp lên trước rồi mới nhận diện, có thật sự tốt hơn không?"** (khuyến nghị)

- Ví dụ đời thường: bạn có ảnh mờ. Có nhiều app "làm nét ảnh" bằng AI. Câu hỏi: cho ảnh qua app làm nét trước, rồi đưa cho YOLO, thì YOLO nhận ra người tốt hơn, hay chỉ trông đẹp mắt người mà máy vẫn không nhận ra tốt hơn?
- Tại sao hay: hai bài báo khoa học đang **cãi nhau**. Một bài nói làm nét giúp tăng 13 đến 36%. Bài khác nói gần như không tăng gì. Bạn đo lại trên camera của mình là một đóng góp thật.
- Bạn sẽ làm gì: đặt ESP32-CAM và điện thoại cạnh nhau (trên cây sào hoặc trên drone), chụp cùng một cảnh, được 300 đến 500 cặp ảnh "xấu và đẹp" của cùng một khung hình. Rồi thử 3 đến 4 phần mềm làm nét có sẵn (không cần tự huấn luyện), đo xem cái nào giúp YOLO, cái nào không, và mỗi cái tốn bao nhiêu mili giây.
- Điểm mạnh: **không cần huấn luyện AI**, rẻ nhất, ít rủi ro nhất, **làm được ngay cả khi drone chưa bay** (thu ảnh bằng sào). Có bộ ảnh cặp thật là thứ rất ít đồ án có.
- Điểm yếu: phải căn chỉnh hai ảnh cho khớp nhau (có thuật toán sẵn, không khó).

**Hướng C: "Đánh giá việc làm nét ảnh bằng hình học thay vì bằng AI"**

- Ví dụ đời thường: ghép nhiều ảnh drone thành một bản đồ lớn (như Google Maps). Muốn ghép được, máy phải tìm các điểm giống nhau giữa hai ảnh. Ảnh xấu thì tìm sai nhiều. Câu hỏi: làm nét ảnh trước có giúp ghép chính xác hơn không?
- Điểm mạnh: xử lý ảnh "cổ điển" (không cần AI học sâu), chạy trên CPU. Phù hợp nếu giảng viên thích phương pháp truyền thống.
- Điểm yếu: không dính tới nhận diện người, xa đề tài IoT hơn.

**Hướng D: "Tự động chỉnh chất lượng nén ảnh trên drone theo phản hồi của AI"**

- Ví dụ đời thường: xem YouTube, mạng yếu thì video tự giảm nét để không giật. Ở đây: AI trên laptop báo "tôi đang không chắc lắm", drone tự tăng chất lượng ảnh; AI báo "rõ rồi", drone giảm chất lượng để tiết kiệm Wi-Fi.
- Điểm mạnh: nối được cả hai môn (Xử lý ảnh + IoT) bằng một cơ chế.
- Điểm yếu: phải chạy thông **toàn bộ** hệ thống (firmware camera, Wi-Fi, backend, AI) thì mới thí nghiệm được. Rủi ro trễ tiến độ cao nhất. Nên để làm phần mở rộng, không làm trục chính.

### Bảng so sánh nhanh

| Hướng | Cần drone bay chưa? | Cần huấn luyện AI? | Cần GPU mạnh? | Độ khó | Độ "mới" |
|---|---|---|---|---|---|
| A | Không | Có (nhẹ) | Vừa | Trung bình | Cao |
| **B** | **Không** | **Không** | Ít | **Thấp nhất** | Cao |
| C | Nên có | Không | Không | Trung bình | Cao |
| D | Bắt buộc | Có | Vừa | Cao | Cao |

### Khuyến nghị của tôi

Chọn **B làm trục chính, A làm phần bổ trợ**. B hoàn thành được sớm và chắc; A tạo ra số liệu gốc không ai sao chép được. D để dành làm chương mở rộng cho môn IoT nếu còn thời gian. C chỉ chọn khi giảng viên yêu cầu phương pháp cổ điển.

### Câu cần trả lời

1. Giảng viên môn Xử lý ảnh có yêu cầu gì cụ thể không (phải dùng học sâu, hay phải dùng phương pháp cổ điển, hay tự do)?
2. Chọn hướng nào làm trục chính? (A, B, C, D, hoặc B+A)
3. Bạn có sẵn điện thoại chụp ảnh tốt để làm "ảnh chuẩn" không? (cần cho B)

---

## Những gì KHÔNG bị chặn bởi hai quyết định này

- Phase 00 đến 10: cài môi trường, drone ảo, backend, website. Làm ngay.
- Phase 11, 12: firmware ArduPilot, DroneBridge, project camera (viết cho cả hai loại board). Không cần biết mua loại nào.
- Phase 14 đến 22: nạp firmware, test trên bàn, lắp ráp, bay thử. Camera chỉ xuất hiện ở Phase 17 (stream thử) và Phase 18 (gắn lên khung).
- AI Phase 1 (chuẩn bị AI): tải bộ VisDrone, cài công cụ gán nhãn, viết pipeline suy giảm ảnh. Dùng chung cho mọi hướng.

Chỉ cần chốt trước khi **lên danh sách mua camera** (Phase 13) và **bắt đầu thí nghiệm** (AI Phase 2).
