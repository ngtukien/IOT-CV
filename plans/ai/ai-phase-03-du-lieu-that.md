# AI Phase 3: Dữ liệu thật từ camera của nhóm

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | **AI Phase 2** (toàn bộ) + **`phase-21`** (drone bay tự động và bay từ web được) cho phần bay. Các bước thu bằng sào (A3.1, A3.5, A3.7) chỉ cần **`phase-17`** (camera lên được web) | ~52 giờ người + **20–45 giờ GPU** *(chưa xác minh)* | **Có** — drone đã bay được, camera đã gắn, pin, sào 2–3 m, điện thoại, vài tấm bìa in bảng chuẩn |

## Mục tiêu

Biến hệ thống đã bay được thành **nguồn dữ liệu gốc**: ảnh thật từ chính camera của nhóm, ở ba dải độ cao, có ghi `jpeg_quality` từng khung, cộng 300–500 cặp ảnh "xấu thật ↔ đẹp thật" chụp cùng cảnh. Rồi dùng dữ liệu đó để **đo lại mọi kết luận** mà AI Phase 2 chỉ đo được trên ảnh suy giảm giả lập.

Đây là phase tạo ra thứ **không sao chép được từ bất kỳ bài báo nào**, và là phần làm cho đồ án khác hẳn "chạy lại thư viện". Cũng là phase **không làm lại được**: quay về sau thì điều kiện ánh sáng, người mẫu, thời tiết đã khác. Chuẩn bị kỹ trước khi ra bãi.

## Đầu vào cần có

- **`ml/experiments/protocol-thu-du-lieu.md`** (sản phẩm của A2.6) — đọc trước tiên, đây là danh sách phải thu.
- `plans/QUYET-DINH-CHUA-CHOT.md` mục "Đã chốt" — quyết định nhánh nào (A3.6 và A3.7 chỉ chạy ở một số nhánh).
- `ml/results/REPORT.md` (AI Phase 2) — biết bảng nào đang trống.
- `ml/results/prelabel_bias.json` (A1.7 chạy thử) — biết quy trình kiểm thiên lệch.
- `docs/bao-cao-tong-quan-du-an.md` §3.7 (bảng độ cao ↔ số pixel trên người), §5.1 (sáu phép đo hồ sơ suy giảm), §6.2 (thang model A→G), §9.1–9.2 (pháp lý + an toàn bay).
- `plans/phase-21-bay-tu-dong-va-web.md` và `plans/phase-22-tranh-vat-can-that-va-tuning.md` — drone phải qua các bài bay ở đó trước.
- Vật tư: sào 2–3 m (hoặc ban công tầng 2–3), điện thoại có camera tốt, **bảng ISO 12233 in trên bìa cứng**, thang xám 11 bậc, lưới ô vuông, một con lắc hoặc quạt đã biết tốc độ (tổng chi phí in ~vài chục nghìn đồng).
- **2–4 người tình nguyện** làm "người trong ảnh", sẵn sàng đứng / ngồi / **nằm** — và đã được xin phép về việc hình ảnh của họ nằm trong dataset.

## File và thư mục sở hữu

**Tạo mới**

```
scripts/capture_session.py                     thu khung + metadata từng khung vào một session
ml/scripts/align_pairs.py                      căn chỉnh cặp ảnh ORB/SIFT + homography + RANSAC
ml/scripts/measure_degradation_profile.py      (nhánh A) đo MTF / nhiễu / méo / vignette / rolling shutter
ml/configs/degrade_esp32_measured.yaml         (nhánh A) YAML có measured: true
ml/configs/own_camera_pairs.yaml
ml/experiments/nhat-ky-thu-du-lieu.md          nhật ký từng buổi: giờ, trời, độ cao, người, sự cố
ml/datasets/own_camera.dvc
ml/datasets/paired.dvc
ml/tests/test_align_pairs.py
```

**Sửa file đã có**

```
ml/configs/own_camera.yaml        trỏ đúng thư mục split thật (AI Phase 1 chưa đụng file này)
ml/results/REPORT.md              ĐIỀN các bảng đang trống; không đổi cấu trúc bảng của A2.7
ml/experiments/ma-tran-thi-nghiem.md   cập nhật trạng thái TN A và TN D từ "chờ" → "đã chạy"
ml/configs/degrade_esp32.yaml     (nhánh A) chỉ cập nhật trường `source`, trỏ sang bản measured
.env                              đổi YOLO_WEIGHTS sang model cuối khi xong A3.10
```

**Chỉ dùng, không sửa**: `ml/scripts/extract_frames.py`, `split_dataset.py`, `train.py`, `evaluate.py`, `coco_eval.py`, `ml/degrade/**`, `ml/restore/**`, `backend/vision/stream.py` (đều thuộc AI Phase 1/2 — cần sửa thì sửa ở đó và chạy lại test của phase sở hữu).

**Tuyệt đối không đụng**: `backend/mavlink/**`, `backend/vision/recorder.py` (thuộc `phase-23`), `firmware/**` (thuộc `phase-12`), `frontend/**`, mọi `plans/phase-*.md`.

---

## Việc theo thứ tự

### A3.0 Chuẩn bị trước khi ra bãi — pháp lý, an toàn, checklist

**Làm gì.** Đọc lại `docs/bao-cao-tong-quan-du-an.md` §9.1 và §9.2. Hai điều không được bỏ qua:

- **Pháp lý.** Từ 20/07/2026 drone tại Việt Nam phải đăng ký và xin phép bay theo chuyến; không tìm thấy ngưỡng miễn trừ theo khối lượng. Trước buổi thu dữ liệu đầu tiên phải có **văn bản của khoa cho phép bay thử trong khuôn viên trường**, hoặc bay ở khu vực đã được phép. Đây là rủi ro thật, không phải thủ tục hình thức.
- **An toàn.** Bán kính bãi tối thiểu 20 m, không người qua lại **ngoài nhóm**, luôn có người cầm tay điều khiển sẵn sàng chuyển về chế độ thủ công, kính bảo hộ khi có điện vào drone.

**Người trong ảnh.** Dataset này có hình ảnh người thật. Trước buổi thu: nói rõ với từng người ảnh sẽ dùng làm gì, lưu ở đâu (ổ cứng + thư mục Drive **riêng tư**), và có xuất hiện trong báo cáo môn học không. Trong báo cáo, **che mặt** ở mọi ảnh minh hoạ. Ghi lại sự đồng ý vào `ml/experiments/nhat-ky-thu-du-lieu.md`.

**Checklist in ra mang theo** (viết vào cuối `protocol-thu-du-lieu.md`):

| Trước khi đi | Tại bãi, trước mỗi lượt bay | Sau mỗi lượt |
|---|---|---|
| Pin sạc đầy (≥ 3 cục), pin điện thoại, pin laptop | Kiểm `jpeg_quality` hiện tại trên `/status` | Copy ngay dữ liệu sang ổ ngoài |
| Laptop phát hotspot, đã test nhận stream ở nhà | Bật `capture_session.py` **trước** khi cất cánh | Ghi nhật ký: giờ, trời, gió, độ cao, số người, sự cố |
| Sào, bảng chuẩn, lưới, thang xám | Ghi `session_id` vào nhật ký giấy | Xem nhanh 10 ảnh bất kỳ — có người trong khung không |
| Văn bản cho phép bay | Kiểm nhiệt độ module camera (69–74 °C là bình thường) | Kiểm `frames.csv` có cột `jpeg_quality` khác rỗng |

**Kết quả mong đợi.** Checklist in ra, văn bản cho phép bay có trong tay, `nhat-ky-thu-du-lieu.md` đã có mẫu bảng.

**Nếu lỗi:**

- Chưa xin được phép bay: **vẫn chạy được A3.1, A3.5, A3.7** (thu bằng sào, không bay). Đó chính là lý do ba bước đó được tách riêng — đề tài Xử lý ảnh không phụ thuộc vào việc bay được.

---

### A3.1 Thu thử bằng sào trước khi bay (giảm rủi ro)

**Làm gì.** Trước khi tiêu một cục pin và một buổi trời đẹp, thu thử **30 phút bằng sào** để phát hiện sớm mọi thứ hỏng: metadata rỗng, stream đứt, ảnh quá tối, người quá nhỏ, tên file sai quy ước.

Gắn camera lên đầu sào 2–3 m, hoặc đứng ở ban công tầng 2–3 chĩa xuống. Cho 2 người đi lại, ngồi, nằm bên dưới. Chạy `capture_session.py` đúng như khi bay.

**Điểm quan trọng để ghi vào báo cáo:** suy giảm ảnh là đặc tính của **camera**, không phải của việc bay. Nên ảnh thu bằng sào có **giá trị khoa học tương đương** cho việc nghiên cứu khôi phục ảnh (hướng B). Chỉ góc nhìn và độ cao là khác — và đó đúng là thứ TN D cần bay thật để đo.

```powershell
python scripts\capture_session.py --session pole_20261010_01 --seconds 300 `
  --url http://<IP camera tren hotspot, xem phase-17>/stream --out ml\datasets\own_camera\sessions
```

**Kết quả mong đợi.** Một session có ≥ 300 khung; `frames.csv` có cột `jpeg_quality` **khác rỗng** ở mọi dòng; mở 10 ảnh thấy người rõ ràng.

**Nếu lỗi:**

- `jpeg_quality` rỗng: firmware chưa phát header `X-Jpeg-Quality` — quay lại `phase-12`, đây là hợp đồng header khai ở `docs/hop-dong-mjpeg.md` (SSOT do `phase-07` tạo). **Phải sửa trước khi bay**, vì thiếu nó là mất một trục thí nghiệm không lấy lại được.
- Ảnh quá tối / cháy sáng: chỉnh cấu hình cảm biến, ghi lại giá trị đã dùng vào nhật ký (nó là một biến, phải biết nó bằng bao nhiêu).
- Stream đứt liên tục: kiểm khoảng cách Wi-Fi, kênh 1 hoặc 11, anten ngoài đã gắn chưa.

---

### A3.2 Quy ước `session_id` và metadata từng khung

**Làm gì.** Đặt tên có kỷ luật ngay từ khung ảnh đầu tiên. Sau khi có 3.000 ảnh mà tên lộn xộn thì không chia tập được, không phân tầng được, và không biết ảnh nào chụp lúc nào.

**Quy ước `session_id`** (bắt buộc, dùng ở mọi script):

```text
<nguon>_<YYYYMMDD>_<NN>[_<thuoc-tinh>]

nguon      : pole | fly | pair | chart
YYYYMMDD   : ngày thu
NN         : số thứ tự lượt trong ngày, 2 chữ số
thuoc-tinh : tuỳ chọn, ví dụ  h05 h08 h12  (độ cao mét)  hoặc  qsweep

Ví dụ:  fly_20261012_03_h08      pole_20261010_01      pair_20261011_02
```

Tên file khung: `<session_id>_<frame_index:06d>.jpg`. `split_dataset.py` (A1.4) cắt theo tiền tố trước dấu `_` — nhưng vì `session_id` có nhiều dấu `_`, phải cấu hình script cắt theo **thư mục cha** `sessions/<session_id>/` thay vì theo tiền tố. Ghi rõ điều này khi gọi script.

**`frames.csv` của mỗi session — một dòng mỗi khung:**

| Cột | Nguồn | Vì sao cần |
|---|---|---|
| `frame_file` | tên file | khoá nối sang nhãn |
| `frame_id` | header `X-Frame-Id` | phát hiện khung bị mất |
| `t_camera_ms` | header `X-Timestamp-Ms` | đồng bộ với telemetry |
| `t_laptop_iso` | đồng hồ laptop | mốc thời gian tuyệt đối |
| `jpeg_quality` | header `X-Jpeg-Quality` | **trục thí nghiệm — thiếu là mất luôn** |
| `framesize` | header `X-Framesize` | VGA hay SVGA |
| `bytes` | độ dài JPEG | dùng cho "độ chính xác trên mỗi byte" (hướng D) |
| `alt_rel_m` | telemetry (nếu bay) | phân tầng theo độ cao cho TN D |
| `lat`, `lon`, `yaw`, `pitch`, `roll` | telemetry | cho phép chiếu toạ độ sau này (§5.6) |
| `note` | tay | "người nằm", "ngược sáng", ... |

`scripts/capture_session.py` đọc khung qua `backend/vision/stream.py` (chỉ **dùng**, không sửa) và telemetry qua API sẵn có của backend. Nếu backend không chạy thì vẫn thu ảnh được, các cột telemetry để rỗng — **ghi rỗng chứ không ghi 0**, vì 0 là một độ cao hợp lệ và sẽ làm hỏng phân tầng.

**Kết quả mong đợi.** Một session mẫu có `frames.csv` đủ cột; tên file khớp quy ước; `split_dataset.py --dry-run` nhận diện đúng session.

**Nếu lỗi:**

- Telemetry và ảnh lệch thời gian: dùng `t_camera_ms` làm trục chính, nội suy telemetry theo `t_laptop_iso`. Ghi độ lệch đo được vào nhật ký — nó là một nguồn sai số cần nêu ở phần "đe doạ tính hợp lệ" của báo cáo.
- `frame_id` nhảy cóc: đang mất khung do Wi-Fi. Bình thường, nhưng **đếm và ghi lại tỉ lệ mất khung** — đó là một số liệu IoT có giá trị.

---

### A3.3 Bay thu dữ liệu ở ba dải độ cao (dữ liệu cho TN D)

**Làm gì.** Thu ảnh ở **5 m / 8 m / 12–15 m**, mỗi dải **≥ 100–150 khung có người**, giữ mọi điều kiện khác tương đương: cùng nhóm người, cùng tư thế, cùng khoảng giờ trong ngày, cùng nền. Đây là dữ liệu duy nhất trả lời được TN D, và TN D là giả thuyết nguyên bản nhất của đề tài.

Bối cảnh số pixel (từ §3.7, tính cho OV2640 VGA nhìn thẳng xuống — **là giá trị danh nghĩa, thay bằng số đo sau khi hiệu chuẩn camera**):

| Độ cao | Điểm ảnh / mét | Người đứng (~0.5 m rộng) | Người nằm (~1.7 m) |
|---|---|---|---|
| 5 m | 123 px/m | ~62 px | ~209 px |
| 8 m | 77 px/m | ~38 px | ~131 px |
| 12 m | 51 px/m | ~26 px | ~87 px |
| 15 m | 41 px/m | ~21 px | ~70 px |

**Giao thức mỗi dải độ cao:**

1. Bay lên đúng độ cao, giữ Loiter ổn định, camera nhìn thẳng xuống.
2. Người bên dưới lần lượt: **đứng yên → đi bộ → ngồi → nằm**, mỗi tư thế ~30 giây. Tư thế **nằm** là quan trọng nhất (dấu hiệu nạn nhân) và cũng là thứ VisDrone thiếu.
3. Bay một vòng nhỏ để có nhiều nền khác nhau (cỏ, bê tông, bóng cây).
4. Hạ xuống, đổi độ cao, lặp lại **với cùng nhóm người và cùng thứ tự tư thế**.

**Giữ `jpeg_quality` cố định** trong các lượt này (ví dụ `q = 12`) — trục độ cao và trục chất lượng nén phải tách nhau, nếu trộn thì không quy trách nhiệm được cho biến nào. Việc quét `q` là lượt riêng ở A3.4.

Ít nhất **2 buổi ở 2 ngày khác nhau** để có đa dạng ánh sáng và để mỗi buổi thành một session riêng — điều kiện cần để chia tập theo session mà vẫn có đủ dữ liệu ở mỗi split.

**Kết quả mong đợi.** ≥ 6 session (3 độ cao × 2 buổi), tổng ≥ 900 khung có người; `alt_rel_m` trong `frames.csv` khớp với độ cao dự định (±1 m).

**Nếu lỗi:**

- Gió mạnh làm drone dạt, độ cao dao động: dùng cột `alt_rel_m` thật để phân rổ, **không dùng độ cao dự định**. Phân rổ theo số đo, ghi rõ dải thực tế trong báo cáo.
- Người quá nhỏ ở 15 m, gán nhãn không nổi: đó **là kết quả**, ghi lại. Nhưng nếu không gán nhãn được thì cũng không đánh giá được — cân nhắc dừng dải cao nhất ở 12 m và ghi lý do.
- Camera nóng rồi tụt fps giữa chuyến: ghi lại hiện tượng theo thời gian bay (nhiệt độ chip 69.7–74.2 °C ở **mọi** độ phân giải, nên không hạ nhiệt bằng cách giảm độ phân giải được). Đây là một số liệu IoT đáng báo cáo.

---

### A3.4 Quét `jpeg_quality` trong một chuyến bay

**Làm gì.** `jpeg_quality` đổi được lúc chạy qua `GET /set?quality=<0..63>` (phase-12 §12.x), nghĩa là **quét cả dải trong một lần bay** — thu được đường cong "độ chính xác theo chất lượng nén" trên dữ liệu thật chứ không phải mô phỏng. Đây là trục trung tâm nối hai môn học (Xử lý ảnh ↔ IoT) bằng một biến duy nhất.

**Giao thức:** giữ độ cao cố định 8 m, giữ nguyên cảnh và người, rồi đi qua dãy `q = 4, 8, 12, 16, 24, 32, 45, 63` (nhớ: **số nhỏ = chất lượng cao**), mỗi mức ~20 giây. Một script nhỏ gọi endpoint điều khiển theo lịch để không phải bấm tay.

Đồng thời ghi lại, cho từng mức `q`: kích thước trung bình mỗi khung (byte), fps thực tế, và tỉ lệ khung mất. Ba con số đó cộng với mAP đo sau này cho ra **"độ chính xác trên mỗi byte truyền"** — chỉ số trung tâm nếu đề tài chốt hướng D.

**Sản phẩm phụ quan trọng: bảng chuyển thang `q_esp` ↔ `q_cv2`.** `ml/configs/degrade_esp32.yaml` (A1.5) hiện dùng thang chất lượng JPEG **phỏng đoán** (`measured: false`) vì chưa có số đo thật — xem ghi chú "thang chất lượng JPEG" trong file đó. Giờ đo thật: chụp **cùng một cảnh** ở từng mức `q_esp` (0–63, esp32-camera, nhỏ = đẹp), rồi tìm mức `q_cv2` của OpenCV (0–100, cao = đẹp) cho kích thước file và PSNR gần nhất. Ghi bảng tra vào `ml/experiments/nhat-ky-thu-du-lieu.md`, rồi cập nhật khối `jpeg` (ở `capture`, `rounds.*`, `final`) trong `ml/configs/degrade_esp32.yaml`: đặt `measured: true` và ghi công thức chuyển thang vào `source` — sửa file cấu hình đó (A1.5 sở hữu), không tự dựng cơ chế riêng ở đây.

**Kết quả mong đợi.** Một session `fly_*_qsweep` có ≥ 8 đoạn ứng với 8 mức `q`; bảng byte/khung theo `q`; bảng tra thang `q_esp` ↔ `q_cv2`.

**Nếu lỗi:**

- `set_quality()` không đổi được lúc chạy: kiểm firmware `phase-12`. Nếu bắt buộc phải khởi động lại camera mỗi lần đổi `q` thì chia thành nhiều lượt bay ngắn và ghi rõ hạn chế.
- Ở `q = 63` ảnh vỡ nát tới mức không gán nhãn nổi: giữ lại vẫn có ích (điểm cuối của đường cong), chỉ cần đánh dấu là "không gán nhãn được" thay vì bỏ.

---

### A3.5 Thu 300–500 cặp ảnh camera rẻ ↔ điện thoại

**Làm gì.** Để PSNR/SSIM/LPIPS có ý nghĩa thì cần **ảnh tham chiếu thật**, không phải ảnh suy giảm giả lập. Cách làm: gắn điện thoại **ngay cạnh** camera rẻ trên cùng một giá đỡ, chụp đồng thời cùng cảnh, rồi căn chỉnh hai ảnh bằng phép biến đổi hình học.

Rất ít đồ án sinh viên có bộ dữ liệu cặp thật — đây là thứ làm nên giá trị của nhánh B.

**Thu ở hai điều kiện:**

- **Trên sào / giá đỡ mặt đất** — làm được ngay, không cần bay, chiếm phần lớn số cặp. Đây là lý do nhánh B "làm được kể cả khi drone chưa bay".
- **Trên drone** — chỉ nếu tải trọng cho phép (điện thoại nặng 180–200 g, khoảng 10% tải hữu ích). Nếu không gắn được thì ghi rõ trong báo cáo rằng ảnh cặp thu ở mặt đất, và đó là một hạn chế cần nêu.

Mục tiêu **300–500 cặp**, đa dạng: có người / không người, sáng / bóng râm / ngược sáng, gần / xa, nền cỏ / bê tông.

**Spec `ml/scripts/align_pairs.py`:**

```text
Vào : ml/datasets/paired/esp32/<session>/  và  ml/datasets/paired/phone/<session>/
Ra  : ml/datasets/paired/aligned/<session>/{lq,hq}/ + align_report.json

1. Ghép cặp theo thời gian chụp (EXIF của điện thoại ↔ t_laptop_iso của camera);
   lệch quá --max-dt-ms (mặc định 200) thì bỏ cặp.
2. Đưa ảnh điện thoại về cùng độ phân giải danh nghĩa với ảnh camera rẻ.
3. Trích đặc trưng: ORB (mặc định, nhanh) hoặc SIFT (--detector sift, chính xác hơn
   khi ảnh mờ nhiều). Khớp bằng BFMatcher + kiểm tỉ lệ Lowe.
4. cv2.findHomography(..., method=cv2.RANSAC, ransacReprojThreshold=3.0)
5. Warp ảnh điện thoại về hệ toạ độ của ảnh camera rẻ; cắt vùng chồng lấn.
6. GHI LẠI cho từng cặp: số điểm khớp, số inlier, TỈ LỆ inlier, sai số reprojection
   trung bình. Bỏ cặp nếu inlier < --min-inliers (mặc định 30) hoặc
   tỉ lệ inlier < 0.25.
7. align_report.json: tổng số cặp vào, số cặp giữ, phân bố tỉ lệ inlier.
```

> **Ghi chú quan trọng về hạn chế.** Homography chỉ đúng khi cảnh **gần như phẳng** hoặc hai camera **gần như cùng tâm quang**. Chụp từ trên cao xuống mặt đất phẳng thì giả thiết này chấp nhận được; nhưng nếu trong khung có vật thể cao (cây, nhà) thì phần đó sẽ lệch. **Phải nêu điều này trong phần "đe doạ tính hợp lệ"** của báo cáo, và khi tính PSNR thì tính trên vùng chồng lấn phẳng, không tính trên toàn ảnh.

`ml/tests/test_align_pairs.py`: dựng một ảnh, tạo bản warp bằng một homography **biết trước**, chạy hàm căn chỉnh, khẳng định ma trận tìm được gần với ma trận thật (sai số reprojection < 2 px). Đây là cách kiểm hàm mà không cần ảnh thật.

**Kết quả mong đợi.** ≥ 300 cặp qua được bộ lọc inlier; `align_report.json` cho thấy tỉ lệ giữ ≥ 60%; xem bằng mắt 20 cặp thấy chúng chồng khít.

**Nếu lỗi:**

- Tỉ lệ inlier rất thấp trên ảnh mờ: đổi sang `--detector sift`, hoặc làm nét nhẹ ảnh camera rẻ **chỉ để tìm điểm khớp** (không dùng ảnh đã làm nét làm dữ liệu — đó là vòng lặp luẩn quẩn).
- Hai ảnh lệch thời gian nên cảnh đã đổi (người đã đi chỗ khác): chụp cảnh tĩnh nhiều hơn; hoặc dùng điều khiển chụp đồng thời.
- Ảnh điện thoại có HDR/làm đẹp tự động: **tắt hết** trước khi chụp. Một ảnh tham chiếu đã bị xử lý thì không còn là tham chiếu.

---

### A3.6 (chỉ nhánh C) Ảnh có chồng lấn cho ghép bản đồ

> Bỏ qua bước này nếu đề tài chốt không phải hướng C.

**Làm gì.** Bay tuyến zigzag với **chồng lấn dọc ≥ 70%** và chồng lấn ngang ≥ 50% trên một khu vực có kết cấu (bãi cỏ có vạch kẻ, sân bê tông có đường nối). Mục tiêu: đủ ảnh để ghép thành một bản đồ lớn và đo xem khôi phục ảnh làm tỉ lệ inlier tăng bao nhiêu, sai số reprojection giảm bao nhiêu.

Ở 8 m và 3 m/s, chồng lấn dọc 80% chỉ cần ~2.4 khung/giây — camera cho ~14 fps nên dư sức. Ràng buộc thật là **đường bay đều và độ cao ổn định**, không phải fps.

Thu thêm một lượt ở độ cao khác để có bài toán đăng ký ảnh đa tỉ lệ. Nếu chưa bay được, thu bằng cách đi bộ với sào theo đường thẳng — kém hơn nhưng vẫn ra được số liệu.

**Kết quả mong đợi.** ≥ 2 tuyến, mỗi tuyến ≥ 60 khung liên tiếp có chồng lấn.

---

### A3.7 (chỉ nhánh A hoặc B+A) Đo hồ sơ suy giảm bằng bảng chuẩn

> Bỏ qua nếu đề tài chốt không có thành phần A.

**Làm gì.** Thay vì nói "ảnh camera rẻ xấu", **đo bằng số** xấu bao nhiêu. Sáu phép đo theo §5.1 của tài liệu tổng quan, chi phí gần như bằng 0 (chỉ tiền in bìa cứng), chạy hoàn toàn trên CPU:

| Đặc tính | Cách đo | Bảng chuẩn |
|---|---|---|
| Độ sắc nét (MTF) | Phương pháp cạnh nghiêng (slanted edge) | Bảng ISO 12233 in trên bìa cứng |
| Nhiễu Poisson–Gauss `(a, b)` | Độ lệch chuẩn theo mức sáng trên các vùng phẳng | Thang xám 11 bậc |
| Artifact khối JPEG | Năng lượng biên khối 8×8 trong miền DCT | Ảnh chuyển màu mượt |
| Méo xuyên tâm | Độ cong của đường thẳng | Lưới ô vuông |
| Vignetting | Suy giảm độ sáng theo bán kính | Bề mặt trắng chiếu đều |
| Rolling shutter | Độ nghiêng của vật chuyển động ngang | Con lắc / quạt quay đã biết tốc độ |

`ml/scripts/measure_degradation_profile.py` nhận thư mục ảnh chụp bảng chuẩn, chạy sáu phép đo, ghi ra **`ml/configs/degrade_esp32_measured.yaml`** — **cùng schema** với `degrade_esp32.yaml` của A1.5, nhưng `measured: true` và `source` ghi rõ ngày đo, số ảnh, cách đo. Đây chính là lý do A1.5 bắt mọi tham số phải nằm trong YAML: đến đây chỉ cần đổi file, không sửa một dòng code nào.

**Điểm đóng góp để nêu thành một câu trong báo cáo:** Real-ESRGAN và BSRGAN phải *đoán* phân bố tham số suy giảm vì không biết camera đích; đề tài này **đo được** tham số thật từ chính camera của mình, nên giữ cấu trúc suy giảm bậc hai của họ nhưng thay phân bố tham số bằng phân bố đo được. Chưa có hồ sơ suy giảm công khai nào cho loại cảm biến này.

**Kết quả mong đợi.** `degrade_esp32_measured.yaml` có `measured: true` và mọi khối tham số điền bằng số đo; so bên cạnh bản phỏng đoán thấy rõ chỗ nào đoán sai.

**Nếu lỗi:**

- Bảng ISO in ra không đủ nét: in ở tiệm laser, dán lên bìa cứng phẳng, chụp vuông góc, chiếu sáng đều hai bên.
- MTF ra số vô lý: kiểm cạnh có nghiêng đúng ~5° không (phương pháp cần cạnh nghiêng nhẹ, không phải thẳng đứng).
- Đo rolling shutter khó: quạt bàn đã biết vòng/phút là đủ; chụp nhiều tốc độ rồi lấy hồi quy.

---

### A3.8 Trích khung, chia theo session, đẩy lên DVC

**Làm gì.** Biến các session thô thành dataset dùng được, và sao lưu **ngay** — dữ liệu này không tái tạo được.

```powershell
# Nếu thu ở dạng video thay vì từng khung
python ml\scripts\extract_frames.py --video raw\fly_20261012_03_h08.mp4 `
  --out ml\datasets\own_camera\sessions\fly_20261012_03_h08\images `
  --every 1.0 --prefix fly_20261012_03_h08

# Chia theo SESSION, không bao giờ random theo khung
python ml\scripts\split_dataset.py --images ml\datasets\own_camera\sessions `
  --train fly_20261012_01_h05,fly_20261012_02_h08,pole_20261010_01 `
  --val   fly_20261014_01_h05 `
  --test  fly_20261014_02_h08,fly_20261014_03_h12 `
  --out   ml\datasets\own_split

# Sao lưu NGAY, trước khi gán nhãn
dvc add ml\datasets\own_camera ml\datasets\paired
git add ml\datasets\own_camera.dvc ml\datasets\paired.dvc ml\datasets\.gitignore
dvc push
```

**Quy tắc lấy khung:** 1 khung mỗi 1–1.5 giây, **không** lấy 30 khung liên tiếp gần như giống hệt. Đa dạng thật quan trọng hơn số lượng.

**Quy tắc chia — nhắc lại vì đây là chỗ dễ hỏng nhất:** một `session_id` chỉ nằm trong **đúng một** split. Tập test phải là **ảnh thật, chưa augment**, và nên chứa ít nhất một dải độ cao **không xuất hiện** trong train — như vậy mới đo được khả năng tổng quát hoá chứ không chỉ khả năng nội suy.

**Kết quả mong đợi.** `ml/datasets/own_split/` có ba split; `split_manifest.json` cho thấy không session nào trùng; `dvc push` xong và `dvc status` sạch.

**Nếu lỗi:**

- `split_dataset.py` không nhận ra session vì `session_id` có nhiều dấu `_`: cấu hình cắt theo **thư mục cha** thay vì tiền tố (A3.2 đã nêu).
- `dvc push` lên Drive rất chậm với vài GB: đẩy qua đêm; hoặc đẩy trước sang remote cục bộ `D:\dvc-store` rồi đồng bộ sau. **Đừng hoãn sao lưu.**

---

### A3.9 Gán nhãn bằng Label Studio, có tập kiểm thiên lệch gán tay

**Làm gì.** Gán nhãn 1.500–2.500 ảnh. Đây là việc tốn thời gian nhất của cả luồng AI, và cũng là chỗ dễ làm hỏng toàn bộ kết quả nhất nếu làm ẩu.

Quy trình **bắt buộc theo đúng thứ tự** (đã dựng và tập dượt ở A1.7):

1. **Rút ngẫu nhiên có seed K = 100 ảnh** làm *tập kiểm thiên lệch*, trải đều ba dải độ cao. Gán nhãn **100% bằng tay**, không cho model chạy trước, **không nhìn output của model**.
2. Chạy `r02` (hoặc `r03`) lên đúng 100 ảnh đó. Tính **tỉ lệ bỏ sót** và **tỉ lệ dương tính giả** của bước tiền-gán-nhãn, **phân tầng theo chiều cao hộp** (`<16`, `16–32`, `32–64`, `>64` px). Ghi vào `ml/results/prelabel_bias.json`.
3. **Luật quyết định:** recall của rổ `<16 px` dưới **0.5** → toàn bộ hộp nhỏ ở phần còn lại phải rà tay 100%, tiền-gán-nhãn chỉ dùng cho hộp lớn. Recall tổng dưới **0.7** → bỏ hẳn tiền-gán-nhãn.
4. Chỉ sau đó mới chạy `prelabel_to_labelstudio.py` cho phần còn lại và sửa tay.

**Vì sao bước này không được bỏ:** model sẽ bỏ sót đúng những trường hợp khó nhất — tức đúng những trường hợp đề tài quan tâm nhất. Người sửa nhãn nhìn màn hình đã có sẵn hộp thì mắt bị "mỏ neo": chỗ nào model không vẽ hộp rất dễ lướt qua. Không có tập kiểm thiên lệch thì nhãn nhiễm thiên lệch của chính model, và **mọi kết luận sau đó đều vô nghĩa**, kể cả khi bảng số trông rất đẹp.

**Gán thêm hai trường tuỳ chọn** đã có trong `label_config.xml`: `pose` (đứng-đi / ngồi / **nằm** / không rõ) và `kho` (mờ / quá nhỏ / bị che / thiếu sáng). Trường `pose` mở đường cho nhánh phân loại tư thế ở §5.5c; trường `kho` cho phép báo cáo riêng trên "tập con khó".

**Ước lượng thời gian:** với tiền-gán-nhãn, khoảng **25–35 giây mỗi ảnh** → 2.000 ảnh ≈ **15–20 giờ**. Không có tiền-gán-nhãn thì gấp đôi. Chia thành nhiều buổi ngắn: gán nhãn liên tục quá 2 giờ thì chất lượng tụt rõ.

**Kết quả mong đợi.** `ml/datasets/own_split/*/labels/` đầy đủ; `classes.txt` đúng một dòng `person`; `prelabel_bias.json` có số và đã áp luật quyết định; `dvc push` lại sau khi có nhãn.

**Nếu lỗi:**

- Xuất YOLO từ Label Studio ra toạ độ sai: kiểm lại thang phần trăm 0–100 vs 0–1 (A1.7).
- Nhãn thiếu ở một số ảnh: ảnh nền hợp lệ (file `.txt` rỗng), nhưng phải **chủ ý** chứ không phải quên — đối chiếu số ảnh và số file nhãn.
- Chán và gán ẩu ở cuối: chia nhỏ buổi, và gán **tập test trước** khi còn tỉnh táo — tập test sai thì mọi con số sai.

---

### A3.10 Huấn luyện lại với dữ liệu thật và đánh giá đầy đủ

**Làm gì.** Giờ mới trả lời được những câu hỏi mà AI Phase 2 chỉ trả lời được bằng đại diện.

**Các run cần chạy:**

| Run id | Nội dung | Tương ứng §6.2 |
|---|---|---|
| `r05_yolo26n_own` | Lấy `r02` (hoặc `r03`) tinh chỉnh tiếp trên ảnh thật đã gán nhãn | **C** |
| `r04_yolo26n_degraded_measured` | *(chỉ nhánh A / B+A)* Sinh lại tập suy giảm bằng `degrade_esp32_measured.yaml` rồi train lại | **D** với tham số đo được |

`E`, `F`, `G` trong §6.2 **không phải là run huấn luyện** — chúng là các lớp thêm vào lúc suy luận và được đánh giá bằng cách bật/tắt cờ, không sinh checkpoint mới:

| Nhãn §6.2 | Thực hiện | Cờ |
|---|---|---|
| **E** = D + SAHI | Chạy `sahi_eval.py` với cấu hình tốt nhất tìm được ở A2.3 | `--sahi` |
| **F** = E + bộ khôi phục tốt nhất | Chạy `bench_restore.py` với bộ thắng ở A2.5 (hoặc bộ thắng đo lại trên ảnh thật) | `--restorer <tên>` |
| **G** = F + hợp nhất đa khung | Trung bình hoá nhiều khung liên tiếp có bù chuyển động bằng homography | *(mở rộng — chỉ làm nếu còn thời gian; nếu bỏ thì **ghi rõ là đã bỏ và vì sao**)* |

**Tinh chỉnh (fine-tune) đúng cách.** Dữ liệu thật ít hơn VisDrone hàng chục lần, nên tinh chỉnh mạnh tay sẽ khiến model quên hết những gì đã học. Khuyến nghị: learning rate thấp hơn (`--lr0 0.0002`), ít epoch hơn (30–50), `--patience 15`, và **trộn thêm một phần VisDrone** vào tập train để giữ nền. Ghi lại tỉ lệ trộn đã dùng.

**Ba bảng phải điền sau khi train xong** — mọi bảng đều có cột **AR-small**:

1. **TN A bản thật — khoảng cách miền.** Cùng một bộ trọng số (`r02`), đánh giá trên (i) VisDrone-val và (ii) tập test ảnh thật. Chênh lệch chính là khoảng cách miền **thật**, thay thế con số đại diện ở A2.2. Nếu khoảng cách thật khác xa con số đại diện thì bản thân điều đó là một phát hiện đáng báo cáo.
2. **TN D — độ cao × model.** Bảng 3×3: ba dải độ cao (5 / 8 / 12–15 m) × ba model (`r02`, `r03`/`r04`, `r05`). Kiểm giả thuyết: độ chính xác có giảm **nhanh hơn** dự đoán thuần theo số pixel không? Cách kiểm: vẽ AR-small theo **chiều cao trung bình của người tính bằng pixel** thay vì theo mét; nếu ba dải độ cao nằm trên **cùng một đường cong** thì giả thuyết **sai** (suy giảm và tỉ lệ độc lập); nếu dải cao hơn nằm **thấp hơn đường cong** thì có tương tác đúng như dự đoán. Cả hai kết quả đều phải báo cáo.
3. **TN C bản thật — bộ khôi phục trên ảnh cặp.** Chạy lại `bench_restore.py` trên tập test ảnh thật, lần này **có cả PSNR/SSIM/LPIPS** vì đã có ảnh tham chiếu từ A3.5. Đây là chỗ kiểm luận điểm trung tâm: có bộ nào **tăng PSNR mà giảm mAP** không? Nếu có, đó là kết quả mạnh nhất của cả đồ án.

**Kết quả mong đợi.** `r05` (và `r04` nếu có nhánh A) train xong; ba bảng trên điền đủ; mọi `metrics.json` có `coco.AR_small`.

**Nếu lỗi:**

- `r05` **tệ hơn** `r02` trên chính tập test thật: thường do quá ít dữ liệu hoặc lr quá cao. Giảm lr, tăng tỉ lệ trộn VisDrone, giảm số epoch. Nếu vẫn vậy thì báo cáo trung thực — "dữ liệu miền đích cỡ này chưa đủ để cải thiện" cũng là một kết luận có giá trị, và nó định lượng được nhu cầu dữ liệu.
- Nhãn tập test có vẻ sai sau khi thấy kết quả kỳ lạ: **không được sửa nhãn test sau khi đã nhìn kết quả** — đó là cách tự lừa mình. Nếu buộc phải sửa thì sửa **toàn bộ** tập theo một tiêu chí thống nhất, ghi lại việc đã sửa, và chạy lại **mọi** model.
- Không đủ thời gian cho `G`: bỏ, nhưng ghi rõ vào mục "những gì không làm" của AI Phase 4.

---

### A3.11 Điền các bảng còn trống trong `REPORT.md`

**Làm gì.** Quay lại `ml/results/REPORT.md` (cấu trúc do A2.7 định), điền **Bảng 6 (độ cao × model)** và cập nhật Bảng 5 bằng số đo trên ảnh thật. Cập nhật `ml/experiments/ma-tran-thi-nghiem.md`: TN A và TN D chuyển từ "chờ dữ liệu bay" sang "đã chạy".

Thêm vào `REPORT.md` một mục mới **"Dữ liệu tự thu"**, ghi bằng số: bao nhiêu session, bao nhiêu khung, bao nhiêu instance `person`, phân bố theo độ cao, phân bố theo `jpeg_quality`, phân bố theo tư thế, tỉ lệ khung mất do Wi-Fi, và kết quả kiểm thiên lệch của bước tiền-gán-nhãn. **Đây là chương dữ liệu không sao chép được từ đâu** — nó phải có số cụ thể, không phải mô tả chung chung.

**Không đổi cấu trúc bảng đã có** ở A2.7 — chỉ điền ô trống và thêm mục mới. Lý do: AI Phase 4 viết prose bám theo cấu trúc đó.

**Kết quả mong đợi.** `REPORT.md` không còn ô nào ghi "chờ dữ liệu bay" (trừ những thứ đã quyết định bỏ, và những thứ đó được ghi rõ là **đã bỏ**, kèm lý do).

---

## Cổng pass

- [ ] Có văn bản cho phép bay (hoặc chứng minh bay trong khu vực được phép); `nhat-ky-thu-du-lieu.md` ghi sự đồng ý của người xuất hiện trong ảnh.
- [ ] ≥ 6 session bay, phủ **ba dải độ cao**, mỗi dải ≥ 100 khung có người, thu ở ≥ 2 ngày khác nhau.
- [ ] **Mọi dòng trong `frames.csv` có `jpeg_quality` khác rỗng.** Đây là cổng cứng — thiếu là mất một trục thí nghiệm không lấy lại được.
- [ ] Một session `qsweep` phủ ≥ 8 mức `q`; có bảng byte/khung theo `q` và bảng tra `q_esp` ↔ `q_cv2`.
- [ ] ≥ 300 cặp ảnh qua được bộ lọc inlier của `align_pairs.py`; `align_report.json` cho tỉ lệ giữ ≥ 60%; xem mắt 20 cặp thấy chồng khít.
- [ ] `test_align_pairs.py` pass (homography biết trước, sai số reprojection < 2 px).
- [ ] `split_manifest.json` chứng minh **không session nào nằm ở hai split**; tập test là ảnh thật chưa augment và chứa ít nhất một dải độ cao không có trong train.
- [ ] `dvc push` xong cho `own_camera` và `paired`; `dvc status` sạch; đã thử `dvc pull` lấy lại một session.
- [ ] `prelabel_bias.json` có số thật và **đã áp luật quyết định** ở A3.9 bước 3.
- [ ] ≥ 1.500 ảnh có nhãn; `classes.txt` đúng một dòng `person`.
- [ ] `r05_yolo26n_own` train xong; (nhánh A) `r04_yolo26n_degraded_measured` train xong với `degrade_esp32_measured.yaml` có `measured: true`.
- [ ] Ba bảng ở A3.10 điền đủ, **mọi bảng có cột AR-small**; E và F đã đánh giá; G đã làm hoặc **đã ghi rõ là bỏ, kèm lý do**.
- [ ] `REPORT.md` có mục "Dữ liệu tự thu" với số cụ thể; `ma-tran-thi-nghiem.md` cập nhật trạng thái TN A và TN D.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Không xin được phép bay đúng lịch → mất cả phase | 3 | 5 | **15** | A3.1, A3.5, A3.7 **không cần bay** — làm trước bằng sào; đề tài Xử lý ảnh được thiết kế để không phụ thuộc vào việc bay được. Liên hệ khoa **trước** khi lên lịch bãi |
| `jpeg_quality` không có trong header → mất vĩnh viễn một trục thí nghiệm | 3 | 5 | **15** | Kiểm ở A3.1 (thu thử bằng sào) **trước** buổi bay đầu; hợp đồng header đã khai ở `docs/hop-dong-mjpeg.md` (`phase-07`) và `phase-12` phải cài đặt đúng |
| Nhãn nhiễm thiên lệch của model do bỏ bước kiểm tay | 4 | 4 | **16** | 100 ảnh gán tay hoàn toàn **trước** khi tiền-gán-nhãn; luật quyết định ở A3.9 bước 3 là bắt buộc, không phải khuyến nghị |
| Rơi/hỏng drone giữa đợt thu dữ liệu | 2 | 5 | **10** | Bay theo an toàn §9.2; luôn có người cầm RC; copy dữ liệu **sau mỗi lượt**, không để cuối buổi; thu dải quan trọng nhất (8 m) **trước** |
| Mất dữ liệu (ổ hỏng, xoá nhầm) — không tái tạo được | 2 | 5 | **10** | `dvc push` **ngay trong ngày thu**, trước cả khi gán nhãn; thêm một bản sao trên ổ ngoài |
| Gán nhãn 2.000 ảnh tốn 15–20 giờ, làm trễ tiến độ | 4 | 3 | **12** | Tiền-gán-nhãn (sau khi qua kiểm thiên lệch); chia buổi ngắn; gán **tập test trước** khi còn tỉnh táo; cắt mục tiêu xuống 1.500 nếu cần |
| `r05` tệ hơn `r02` vì quá ít dữ liệu miền đích | 3 | 3 | **9** | lr thấp, ít epoch, trộn VisDrone vào train; nếu vẫn vậy thì **báo cáo trung thực** — nó định lượng nhu cầu dữ liệu |
| Homography sai vì cảnh không phẳng (cây, nhà trong khung) | 3 | 3 | **9** | Chọn cảnh phẳng khi thu cặp; lọc theo tỉ lệ inlier; tính PSNR trên vùng chồng lấn phẳng; **nêu ở mục đe doạ tính hợp lệ** |
| Camera nóng rồi tụt fps giữa chuyến | 3 | 2 | **6** | Không giảm được bằng cách hạ độ phân giải (nhiệt 69–74 °C ở mọi mức); dựa vào luồng gió cánh quạt; **ghi lại hiện tượng như một số liệu IoT** |
| Điều kiện ánh sáng giữa các buổi khác nhau làm nhiễu so sánh độ cao | 3 | 3 | **9** | Thu cả ba dải độ cao **trong cùng một buổi**, lặp ở buổi thứ hai; ghi giờ và trời vào nhật ký; nếu vẫn lệch thì đưa "buổi" vào như một biến nhiễu và nêu rõ |
| Sửa nhãn tập test sau khi đã nhìn kết quả | 2 | 5 | **10** | Luật cứng ở A3.10: nếu buộc phải sửa thì sửa toàn bộ theo một tiêu chí, ghi lại, và chạy lại **mọi** model |
| Người tình nguyện không đến đúng buổi | 3 | 2 | **6** | Hẹn dư người; buổi dự phòng; tư thế nằm có thể do chính thành viên nhóm thực hiện |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| A3.0 Pháp lý, an toàn, checklist | 3.0 | Thời gian chờ khoa duyệt nằm ngoài con số này |
| A3.1 Thu thử bằng sào | 2.0 | Bắt lỗi sớm, tiết kiệm cả buổi bay |
| A3.2 Quy ước session + `capture_session.py` | 4.0 | Script này quyết định chất lượng mọi thứ sau |
| A3.3 Bay thu ba dải độ cao (2 buổi) | 8.0 | Gồm di chuyển, dựng bãi, đổi pin |
| A3.4 Quét `jpeg_quality` + bảng tra thang | 3.0 | Một lượt bay + phân tích |
| A3.5 Thu cặp ảnh + `align_pairs.py` + test | 7.0 | Thu ~2 h, viết script ~4 h, kiểm ~1 h |
| A3.6 *(nhánh C)* Ảnh chồng lấn cho ghép bản đồ | 3.0 | Bỏ nếu không phải nhánh C |
| A3.7 *(nhánh A)* Đo hồ sơ suy giảm bằng bảng chuẩn | 6.0 | In bảng + chụp + viết script đo. Bỏ nếu không có thành phần A |
| A3.8 Trích khung, chia session, DVC push | 3.0 | Cộng thời gian upload chạy nền |
| A3.9 Gán nhãn + kiểm thiên lệch | 18.0 | **Việc lớn nhất.** 100 ảnh gán tay chiếm ~2 h trong đó |
| A3.10 Train lại + đánh giá E/F/G | 8.0 người | **+ 20–45 giờ GPU** *(chưa xác minh)* |
| A3.11 Điền `REPORT.md` | 4.0 | |
| **Tổng** | **~52 giờ người** (trừ ~9 h nếu bỏ nhánh A và C) | **+ 20–45 giờ GPU chạy nền** |

Đường găng: A3.0 → A3.1 → A3.3 → A3.8 → A3.9 → A3.10 → A3.11. **A3.9 (gán nhãn) là nút thắt thật**, không phải GPU. A3.5 và A3.7 chạy song song với A3.3 được vì không cần bay.

## Ghi chú cho sổ tay

Để agent viết `docs/so-tay/ai-03-du-lieu-that.md`:

**Về thu dữ liệu**

- *Vì sao dữ liệu tự thu là phần giá trị nhất của đồ án* — ai cũng tải được VisDrone; không ai có ảnh từ đúng camera này ở đúng điều kiện này.
- *Vì sao thu bằng sào vẫn có giá trị khoa học* — suy giảm ảnh là đặc tính của **camera**, không phải của việc bay. Chỉ góc nhìn và độ cao là khác.
- *Session* — một "lượt" thu liền mạch. Vì sao mọi thứ phải gắn với session.
- *Metadata từng khung* và vì sao `jpeg_quality` là thứ **mất rồi không lấy lại được**.
- *Ghi rỗng chứ không ghi 0* khi thiếu telemetry — 0 mét là một độ cao hợp lệ.

**Về ảnh cặp và căn chỉnh**

- *Ảnh cặp (paired images)* — cùng một cảnh chụp bằng hai camera khác chất lượng, dùng ảnh tốt làm "đáp án" để chấm ảnh xấu.
- *Đặc trưng ORB/SIFT* — máy tìm những "điểm đặc biệt" (góc, đốm) xuất hiện ở cả hai ảnh.
- *Homography* — phép biến đổi kéo ảnh này khớp lên ảnh kia, đúng khi cảnh gần như phẳng.
- *RANSAC* — cách loại bỏ các cặp điểm khớp sai bằng cách thử nhiều lần rồi giữ phương án nhiều điểm đồng thuận nhất. Ví dụ đời thường: hỏi 100 người, tin theo nhóm đông nhất trả lời giống nhau.
- *Inlier ratio* — tỉ lệ điểm khớp "đúng"; dùng làm thước đo chất lượng căn chỉnh **và** làm chỉ số đánh giá ở hướng C.
- *Vì sao phải tắt HDR và làm đẹp tự động của điện thoại* — ảnh tham chiếu đã bị xử lý thì không còn là tham chiếu.

**Về gán nhãn**

- *Vì sao tiền-gán-nhãn tiết kiệm thời gian nhưng nguy hiểm* — máy bỏ sót đúng chỗ khó, người nhìn theo máy nên cũng bỏ sót.
- *Hiệu ứng mỏ neo (anchoring)* — thấy sẵn đáp án thì khó nghĩ khác.
- *Tập kiểm thiên lệch* — 100 ảnh gán tay hoàn toàn để đo xem máy bỏ sót bao nhiêu.
- *Vì sao gán tập test trước* — tập test sai thì mọi con số sai, nên làm lúc còn tỉnh táo.

**Về đo đạc và hồ sơ suy giảm**

- *MTF* — thước đo độ nét: ảnh chuyển từ đen sang trắng "gắt" hay "nhoè dần".
- *Nhiễu Poisson–Gauss `(a, b)`* — hai loại nhiễu: một loại tỉ lệ với độ sáng (đếm photon), một loại cố định (mạch điện).
- *Méo xuyên tâm* — đường thẳng bị cong ở rìa ảnh do ống kính.
- *Vì sao đo được tham số thật lại là đóng góp* — các bài báo lớn phải **đoán** vì họ không biết camera đích; nhóm thì biết.

**Về tính trung thực của thí nghiệm**

- *Vì sao không được sửa nhãn tập test sau khi nhìn kết quả.*
- *Biến nhiễu (confounder)* — nếu thu ba độ cao vào ba buổi trời khác nhau thì không biết chênh lệch do độ cao hay do ánh sáng.
- *Một giả thuyết bị bác bỏ vẫn là kết quả* — TN D dự đoán có tương tác giữa suy giảm và tỉ lệ; nếu dữ liệu nói không có, đó vẫn là phát hiện.
- *Riêng tư* — vì sao che mặt trong báo cáo và vì sao ảnh không lên cloud công cộng.
