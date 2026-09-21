# AI Phase 4: Báo cáo môn Xử lý ảnh

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | **AI Phase 3** (toàn bộ). Đọc thêm `phase-24` nếu đề tài chốt hướng D (số liệu IoT nằm ở đó) | ~28 giờ người + ~2 giờ GPU (chạy lại để kiểm tái lập) | Không |

## Mục tiêu

Biến đống số liệu trong `ml/results/` thành một báo cáo môn học đọc được, trung thực, và **tái lập được**: có câu hỏi nghiên cứu rõ ràng, có phương pháp mô tả đủ để người khác làm lại, có bảng và hình sinh tự động từ dữ liệu gốc, có mục thừa nhận hạn chế, và một script chạy một lệnh dựng lại toàn bộ kết quả.

Tiêu chí thành công không phải "bảng số đẹp". Là: **người chấm đọc xong biết chính xác nhóm đã hỏi gì, đo thế nào, kết quả ra sao, và chỗ nào chưa chắc chắn.**

## Đầu vào cần có

- `ml/results/REPORT.md` — mọi bảng đã điền (AI Phase 3 A3.11). Đây là nguồn số liệu duy nhất; báo cáo **không được chứa con số nào không truy ngược được về file trong `ml/results/`**.
- `plans/QUYET-DINH-CHUA-CHOT.md` mục "Đã chốt" — quyết định cấu trúc chương.
- `ml/experiments/ma-tran-thi-nghiem.md`, `nhat-ky-thu-du-lieu.md`, `ml/results/dataset_stats.json`, `prelabel_bias.json`, `align_report.json`, `bench_backends.json`, `restore_bench.json`, `sahi_sweep.json`, `ml/results/r0*/metrics.json` + `env.json`.
- `plans/reports/260921-research-ai-vision-pipeline.md` §8 (URL đã kiểm chứng) và §9 (**URL CHƯA kiểm chứng — phải tự mở trước khi trích**).
- `docs/bao-cao-tong-quan-du-an.md` §6.5 (nguyên tắc báo cáo), §9.1 (pháp lý).
- `ml/data/README.md` và `ml/restore/WEIGHTS.md` — nguồn cho mục giấy phép.
- Yêu cầu cụ thể của giảng viên: số trang, định dạng, kiểu trích dẫn, hạn nộp. **Hỏi trước khi viết**, không đoán.

## File và thư mục sở hữu

**Tạo mới**

```
docs/bao-cao-xla/00-tom-tat.md
docs/bao-cao-xla/01-gioi-thieu.md
docs/bao-cao-xla/02-tong-quan-tai-lieu.md
docs/bao-cao-xla/03-phuong-phap.md
docs/bao-cao-xla/04-thuc-nghiem-va-du-lieu.md
docs/bao-cao-xla/05-ket-qua.md
docs/bao-cao-xla/06-ban-luan.md
docs/bao-cao-xla/07-de-doa-tinh-hop-le.md
docs/bao-cao-xla/08-ket-luan-va-huong-phat-trien.md
docs/bao-cao-xla/09-nhung-gi-khong-lam.md
docs/bao-cao-xla/10-tai-lieu-tham-khao.md
docs/bao-cao-xla/11-phu-luc-tai-lap.md
docs/bao-cao-xla/README.md               thứ tự chương + cách xuất ra PDF/DOCX
ml/scripts/make_figures.py               sinh MỌI hình từ JSON trong ml/results/
ml/scripts/reproduce.ps1                 dựng lại toàn bộ kết quả bằng một lệnh
ml/results/figures/                      hình sinh ra (gitignore; commit bản chốt nếu cần nộp)
```

**Chỉ đọc, không sửa**: `ml/results/**` (số liệu gốc — sửa số liệu ở khâu viết báo cáo là gian lận), `ml/experiments/**`, `ml/scripts/{train,evaluate,coco_eval,bench_restore,sahi_eval,export_and_bench}.py`, `ml/degrade/**`, `ml/restore/**`.

**Tuyệt đối không đụng**: `backend/**`, `frontend/**`, `firmware/**`, mọi `plans/phase-*.md`, `docs/bao-cao-tong-quan-du-an.md` (tài liệu tổng quan là nguồn, không phải sản phẩm của phase này).

---

## Việc theo thứ tự

### A4.0 Chốt phạm vi báo cáo theo đề tài đã chọn

**Làm gì.** Đọc mục "Đã chốt" trong `plans/QUYET-DINH-CHUA-CHOT.md` (ghi ở A2.0). Đề tài quyết định **câu hỏi nghiên cứu chính** và do đó quyết định chương nào là trọng tâm, chương nào rút gọn. Bảng dưới đây là bản đồ chuyển từ quyết định sang cấu trúc báo cáo — không phải chỗ để chọn lại.

| Đề tài đã chốt | Câu hỏi nghiên cứu chính (một câu, đưa nguyên vào §01) | Chương trọng tâm | Bảng/hình chủ lực | Chương rút gọn |
|---|---|---|---|---|
| **B** | "Trên ảnh cặp **thật** từ camera nhúng giá rẻ, phương pháp khôi phục nào làm tăng mAP, phương pháp nào chỉ tăng PSNR mà **giảm** mAP, và mỗi phương pháp tốn bao nhiêu ms/khung?" | §05 Kết quả (bảng khôi phục), §06 Bàn luận | Bảng 5 (bộ khôi phục trên ảnh thật, có PSNR/SSIM/LPIPS **và** mAP/AR-small); hình phân tán "Δ mAP theo ms" | §03 phần huấn luyện (vì hướng B không cần huấn luyện gì) |
| **B + A** | Như B, **cộng**: "Mô phỏng suy giảm theo **tham số đo được** có thu hẹp khoảng cách miền tốt hơn mô phỏng đoán theo phân bố chung của Real-ESRGAN/BSRGAN không?" | §03 Phương pháp (chương hồ sơ suy giảm), §05 | Thêm bảng so `r03` (đoán) vs `r04` (đo được); bảng sáu phép đo MTF/nhiễu/méo/vignette/rolling-shutter | — |
| **C** | "Mỗi phương pháp khôi phục làm **tỉ lệ đặc trưng inlier** tăng bao nhiêu và **sai số reprojection** giảm bao nhiêu khi ghép/đăng ký ảnh?" | §03 (hình học: ORB/AKAZE/RANSAC/homography), §05 | Bảng inlier ratio + reprojection error theo bộ khôi phục; hình mosaic trước/sau | §03 phần học sâu; bỏ bảng độ cao |
| **D** | "Đóng vòng: độ tin cậy của bộ phát hiện điều khiển `jpeg_quality` theo thời gian thực. Điểm làm việc nào tối ưu **độ chính xác trên mỗi byte truyền**?" | §03 (vòng điều khiển), §05 (đường cong mAP theo q) | Đường cong mAP–theo–`q`; bảng accuracy-per-byte; so vòng kín vs `q` cố định | §02 phần khôi phục ảnh |

**Quy tắc chung cho mọi nhánh:** bộ phát hiện người (YOLO) là **thước đo**, không phải kết quả. Nếu báo cáo đọc như "chúng em chạy YOLO và nó nhận ra người" thì đã trượt khỏi câu hỏi nghiên cứu — quay lại bảng trên.

**Hỏi giảng viên trước khi viết** (ghi câu trả lời vào `docs/bao-cao-xla/README.md`): số trang tối thiểu/tối đa, kiểu trích dẫn (IEEE / APA / số thứ tự), nộp PDF hay DOCX, có cần bản in không, có cần demo trực tiếp không, hạn nộp.

**Kết quả mong đợi.** `docs/bao-cao-xla/README.md` ghi: đề tài đã chốt, câu hỏi nghiên cứu một câu, danh sách chương kèm chương nào trọng tâm, yêu cầu của giảng viên.

---

### A4.1 Khung chương và bản đồ "bảng/hình → chương"

**Làm gì.** Viết dàn ý trước, viết prose sau. Mỗi chương ghi: mục đích một câu, những bảng/hình nào thuộc về nó, và nguồn số liệu cụ thể (đường dẫn file).

| Chương | Mục đích một câu | Bảng / hình | Nguồn số liệu |
|---|---|---|---|
| 00 Tóm tắt | Câu hỏi, cách làm, con số chính, kết luận — gói trong ~200 từ | — | — |
| 01 Giới thiệu | Vì sao bài toán này khó và vì sao câu hỏi này đáng hỏi | Hình: ảnh cùng cảnh từ camera rẻ và từ điện thoại, đặt cạnh nhau | `ml/datasets/paired/aligned/` |
| 02 Tổng quan tài liệu | Hai bài báo **mâu thuẫn nhau** về việc khôi phục ảnh có giúp phát hiện không, cộng nền tảng về độ bền và thích nghi miền | Bảng so hai kết luận trái ngược | §3.5 báo cáo nghiên cứu |
| 03 Phương pháp | Mô tả đủ để người khác làm lại | Sơ đồ pipeline; sơ đồ chuỗi suy giảm bậc hai; bảng sáu phép đo (nhánh A) | `ml/degrade/`, `degrade_esp32*.yaml` |
| 04 Thực nghiệm và dữ liệu | Dữ liệu nào, bao nhiêu, thu thế nào, chia thế nào | Bảng thống kê dataset; phân bố kích thước hộp; phân bố theo độ cao và theo `q` | `dataset_stats.json`, mục "Dữ liệu tự thu" |
| 05 Kết quả | Chỉ số, không diễn giải | Bảng 1–6 của `REPORT.md` | `ml/results/**` |
| 06 Bàn luận | Con số đó **nghĩa là gì** | Hình phân tán Δ mAP / ms | `restore_bench.json` |
| 07 Đe doạ tính hợp lệ | Chỗ nào kết luận có thể sai | — | A4.5 |
| 08 Kết luận và hướng phát triển | Trả lời đúng câu hỏi ở §01 | — | — |
| 09 Những gì không làm | Trung thực về phạm vi | — | A4.6 |
| 10 Tài liệu tham khảo | — | — | §8 báo cáo nghiên cứu |
| 11 Phụ lục tái lập | Chạy lại thế nào | — | A4.7 |

**Luật một câu, áp cho toàn báo cáo:** *mỗi con số trong báo cáo phải truy ngược được về một file cụ thể trong `ml/results/`.* Con số nào không truy ngược được thì hoặc xoá, hoặc gắn nhãn rõ là **trích dẫn từ tài liệu khác** kèm nguồn.

---

### A4.2 Sinh toàn bộ hình từ số liệu, không vẽ tay

**Làm gì.** Viết `ml/scripts/make_figures.py` đọc thẳng các file JSON trong `ml/results/` rồi xuất hình vào `ml/results/figures/`. **Không chụp màn hình bảng Excel, không vẽ tay.** Lý do: số liệu sẽ còn thay đổi (chạy lại, thêm seed, sửa nhãn) và mỗi lần đổi mà phải vẽ lại tay thì sớm muộn hình sẽ lệch với bảng — lỗi này rất khó phát hiện và rất mất điểm.

Danh sách hình tối thiểu:

| Hình | Nội dung | Nguồn |
|---|---|---|
| `fig01_size_distribution.png` | Phân bố chiều cao hộp (px) của VisDrone và của dữ liệu tự thu, đặt chồng | `dataset_stats.json` |
| `fig02_model_compare.png` | Cột: mAP50 / mAP50-95 / **AR-small** cho từng run | `r0*/metrics.json` |
| `fig03_domain_gap.png` | Bảng nhiệt 2×2 (model sạch/suy giảm × val sạch/suy giảm) | A2.2 |
| `fig04_sahi_tradeoff.png` | Phân tán: mAP50 theo ms/khung, mỗi điểm một cấu hình lát | `sahi_sweep.json` |
| `fig05_backend_fps.png` | Cột fps của pt / pt-fp16 / onnx / engine, kèm mAP để thấy có đánh đổi không | `bench_backends.json` |
| `fig06_restore_tradeoff.png` | **Hình chủ lực của nhánh B:** trục X = ms/khung, trục Y = Δ mAP50 so với `none`; mỗi bộ khôi phục một điểm; vẽ thêm đường của `bicubic` làm mốc | `restore_bench.json` |
| `fig07_restore_by_size.png` | Δ recall theo rổ kích thước (`<16`, `16–32`, `32–64`, `>64` px) cho từng bộ khôi phục | `restore_bench.json` |
| `fig08_psnr_vs_map.png` | **Hình đắt giá nhất:** trục X = PSNR, trục Y = mAP50. Nếu có điểm nằm ở góc "PSNR cao, mAP thấp" thì luận điểm trung tâm được chứng minh bằng một hình duy nhất | AI Phase 3 A3.10 |
| `fig09_altitude.png` | AR-small theo chiều cao người tính bằng **pixel**, tô màu theo dải độ cao. Ba dải nằm trên cùng một đường cong ⇒ giả thuyết TN D sai; dải cao nằm thấp hơn ⇒ có tương tác | A3.10 |
| `fig10_quality_curve.png` | mAP theo `jpeg_quality`, cộng byte/khung trên trục phụ | A3.4 |

Quy ước hình: chú thích trục có đơn vị, ghi rõ tập dữ liệu và số mẫu trong caption, dùng được khi in **đen trắng** (phân biệt bằng hình dạng điểm và kiểu nét, không chỉ bằng màu).

**Kết quả mong đợi.** `python ml\scripts\make_figures.py` sinh toàn bộ hình trong một lần chạy, không cần thao tác tay.

**Nếu lỗi:**

- Thiếu file JSON: script phải **báo rõ thiếu file nào** rồi thoát, không vẽ hình rỗng. Hình rỗng trông như hình thật và sẽ lọt vào báo cáo.
- Hình rối vì quá nhiều điểm: tách thành hai hình thay vì nhồi.

---

### A4.3 Viết chương phương pháp (§03) và chương dữ liệu (§04)

**Làm gì.** Đây là hai chương quyết định việc người khác có làm lại được không — tức quyết định báo cáo có phải là công trình khoa học hay chỉ là bản mô tả.

**§03 Phương pháp phải trả lời đủ:**

- Model nào, bao nhiêu tham số, `imgsz` bao nhiêu, bao nhiêu epoch, optimizer gì, learning rate bao nhiêu, seed nào, **chạy mấy seed**.
- Chuỗi suy giảm: thứ tự các bước, phân bố tham số từng bước, và **tham số đó từ đâu ra** (đoán theo Real-ESRGAN/BSRGAN, hay đo được ở A3.7). Nêu rõ điểm khác biệt: hai bài báo kia phải *đoán* vì không biết camera đích; nhóm **đo được**.
- Bộ khôi phục: tên, nguồn trọng số, cắm vào chỗ nào trong đường ống (**trước** bước letterbox/resize của detector), và **hai nhóm đối chứng**: `none` và `bicubic`.
- Chỉ số: định nghĩa mAP50, mAP50-95, **AR-small** (AR cho vật thể diện tích < 32² px theo chuẩn COCO), bốn rổ chiều cao pixel riêng của dự án, và cách đo độ trễ (warmup 30, đo 300 khung, batch 1).

**§04 Dữ liệu phải trả lời đủ:**

- VisDrone: bao nhiêu ảnh mỗi split, bao nhiêu instance `person` **sau khi lọc** (lấy từ `dataset_stats.json`, không trích từ bài báo khác), cách gộp `pedestrian` + `people`, cách xử lý `score == 0`, tỉ lệ ảnh nền giữ lại.
- Dữ liệu tự thu: bao nhiêu session, bao nhiêu khung, phân bố theo độ cao / `jpeg_quality` / tư thế, tỉ lệ khung mất do Wi-Fi.
- Quy trình gán nhãn **và kết quả kiểm thiên lệch** — con số recall của bước tiền-gán-nhãn theo từng rổ kích thước. Nêu thẳng: nếu không có bước kiểm này thì nhãn sẽ nhiễm thiên lệch của chính model.
- Luật chia theo session và vì sao không chia ngẫu nhiên theo khung.
- Ảnh cặp: bao nhiêu cặp thu, bao nhiêu cặp giữ sau lọc inlier, tiêu chí lọc.

**Về văn phong.** Viết như giải thích cho một bạn cùng lớp chưa làm đề tài này: câu ngắn, chủ ngữ rõ, hạn chế câu bị động. Tránh lối viết máy móc — ba gạch đầu dòng cho mọi thứ, câu mở bài sáo rỗng ("Trong thời đại công nghệ 4.0..."), và kết đoạn nào cũng tóm tắt lại chính đoạn vừa viết. Đọc to một đoạn bất kỳ: nghe không giống người nói thì viết lại.

**Kết quả mong đợi.** Một người ngoài nhóm đọc §03 + §04 rồi dựng lại được thí nghiệm mà không phải hỏi thêm câu nào.

---

### A4.4 Viết chương kết quả (§05) và bàn luận (§06)

**Làm gì.** §05 chỉ trình bày số, §06 mới diễn giải. Tách hai việc này là cách đơn giản nhất để không vô tình biến suy đoán thành kết luận.

**Mục "kỳ vọng trung thực" phải nằm ngay đầu §05**, trước mọi bảng:

> Model nano chạy toàn khung trên VisDrone đạt mAP50 khoảng **21.9% cho lớp `pedestrian`** và **11.7% cho lớp `people`** (CF-YOLO, *Scientific Reports*, cùng dataset, imgsz 640). Đây là hai lớp khó nhất của bộ dữ liệu vì nhỏ nhất. Gộp còn một lớp `person` thường nâng con số này lên; mục tiêu đặt ra cho dự án là **mAP50 trong khoảng 30–45%**. Mọi con số dưới đây phải đọc trong khung tham chiếu đó.

**Sáu luật viết kết quả, không được vi phạm:**

1. **Cấm "độ chính xác 95%".** Mọi con số kèm: tên chỉ số, tập dữ liệu, ngưỡng IoU, ngưỡng tin cậy, số mẫu (§6.5 tài liệu tổng quan).
2. **Mọi bảng có cột AR-small.** mAP tổng hợp che mất đúng thứ đề tài quan tâm — người cao 21–38 px.
3. **Ghi rõ số seed.** Một seed thì nói là một seed, và kèm câu: "chênh lệch dưới 2 điểm mAP không được diễn giải là khác biệt thật".
4. **Trích dẫn SAHI phải ghi tên detector**: 6.8% (chỉ suy luận) và 12.7% (cộng dồn với tinh chỉnh theo lát) là của **FCOS**, không phải YOLO. Con số của YOLO26n là đóng góp riêng của nhóm.
5. **Số đo tốc độ kèm điều kiện**: RTX 4060 Laptop, batch 1, imgsz 640, backend nào, driver bản nào.
6. **Kết quả âm vẫn báo cáo.** Nếu một bộ khôi phục làm giảm mAP, hoặc `r05` tệ hơn `r02`, hoặc giả thuyết TN D bị bác bỏ — viết ra. Một giả thuyết bị dữ liệu bác bỏ là kết quả khoa học; giấu nó đi thì không.

**§06 Bàn luận trả lời ba câu:**

- Câu hỏi ở §01 được trả lời thế nào, bằng con số nào?
- Kết quả của nhóm đứng ở đâu giữa hai bài báo mâu thuẫn ở §02 — nghiêng về bên nào, và **trong điều kiện nào**?
- Điều gì bất ngờ? Chỗ bất ngờ thường là chỗ có giá trị nhất. Ví dụ: một bộ khôi phục tăng PSNR rõ rệt mà mAP đứng yên hoặc giảm — nếu quan sát được điều đó thì đó chính là luận điểm trung tâm, và `fig08` là bằng chứng.

---

### A4.5 Chương "Đe doạ tính hợp lệ" (§07)

**Làm gì.** Liệt kê thẳng những chỗ kết luận có thể sai. Chương này làm báo cáo **mạnh hơn**, không yếu đi: người chấm sẽ tự nghĩ ra những điểm này, và việc nhóm nêu trước cho thấy nhóm hiểu việc mình làm.

Danh sách tối thiểu (bỏ mục nào thì phải vì nó không áp dụng, không phải vì nó bất tiện):

| Đe doạ | Nội dung | Mức ảnh hưởng đến kết luận |
|---|---|---|
| **Cỡ mẫu nhỏ** | Dữ liệu tự thu chỉ vài nghìn khung, trên một bãi, vài buổi, vài người. Không đại diện cho mọi địa hình và thời tiết | Cao — hạn chế tính tổng quát |
| **Một seed** | Nếu chỉ chạy một seed thì chênh lệch nhỏ giữa các model không phân biệt được với nhiễu | Trung bình — chỉ ảnh hưởng các so sánh sát nhau |
| **Tham số suy giảm phỏng đoán** | Trừ khi đã làm A3.7, mọi kết luận về "augment suy giảm giúp bao nhiêu" đều dựa trên phân bố đoán | Cao với nhánh B đơn thuần, thấp với B+A |
| **Homography giả thiết cảnh phẳng** | Vật thể cao trong khung sẽ lệch sau khi căn chỉnh; PSNR/SSIM tính trên vùng đó không đáng tin | Trung bình — đã lọc theo inlier nhưng không loại hết |
| **Thiên lệch của tiền-gán-nhãn** | Dù đã kiểm bằng tập 100 ảnh, phần còn lại vẫn có thể nhiễm nhẹ thiên lệch của model | Trung bình — có số đo định lượng trong `prelabel_bias.json` |
| **Biến nhiễu về ánh sáng** | Nếu ba dải độ cao thu ở ba buổi khác nhau thì không tách được ảnh hưởng của độ cao khỏi ảnh hưởng của ánh sáng | Cao với TN D — nêu rõ đã thu cùng buổi hay không |
| **Ảnh cặp thu ở mặt đất** | Nếu không gắn được điện thoại lên drone thì ảnh cặp không có rung động và nhoè do bay | Trung bình với nhánh B |
| **Tập test nhỏ** | 300–500 khung cho một kết luận về mAP là ít; khoảng tin cậy rộng | Trung bình — báo cáo khoảng tin cậy bootstrap |
| **Mơ hồ giấy phép VisDrone** | Không có file LICENSE; dùng theo thông lệ học thuật | Không ảnh hưởng kết quả, ảnh hưởng quyền công bố |
| **Không kiểm chứng chéo với detector khác** | Mọi kết luận đo bằng YOLO26n/YOLO11n; một detector khác có thể phản ứng khác với cùng bộ khôi phục | Trung bình — nêu là hướng phát triển |

Mỗi mục viết 2–3 câu: đe doạ là gì, đã làm gì để giảm, còn lại bao nhiêu.

---

### A4.6 Chương "Những gì không làm" (§09)

**Làm gì.** Liệt kê rõ những thứ đã cân nhắc rồi **chủ động loại**, kèm lý do. Khác với §07 (chỗ có thể sai), chương này nói về **phạm vi** (chỗ cố tình không đi tới).

Mẫu nội dung:

| Đã cân nhắc | Không làm vì |
|---|---|
| Chạy AI ngay trên máy bay (on-board) | Đo được: YOLOv8n trên Raspberry Pi Zero 2W ≈ 7.6 giây/ảnh (~0.13 fps), với NCNN ≈ 3.8 giây — chênh 50–100 lần so với mức dùng được. Kiến trúc "suy luận trên laptop" là lựa chọn có căn cứ, không phải né tránh |
| Dataset UAVDT | **Không chú thích người**, chỉ có xe. Thường bị liệt kê nhầm trong các danh sách "dataset UAV cho phát hiện người" |
| Dataset TinyPerson | Giấy phép cấm thương mại và **cấm đăng ảnh nhận dạng được người** |
| Model lớn hơn (YOLO26s/m) | 8 GB VRAM và mục tiêu chạy thời gian thực; nano đã dư so với 14.19 fps của camera |
| Hạ `imgsz` xuống 320 để chạy nhanh hơn | Người chỉ cao ~38 px ở 640; xuống 320 còn ~19 px là mất mục tiêu. Thà giảm batch |
| Giả lập độ cao bằng cách thu nhỏ ảnh VisDrone | Không tái tạo được việc artifact chiếm tỉ lệ lớn hơn trên vật thể nhỏ — mà đó **chính là** nội dung giả thuyết TN D |
| Hợp nhất đa khung (§6.2 G) | *(nếu bỏ)* Thiếu thời gian; cần bù chuyển động chính xác. Ghi là hướng phát triển |
| Roboflow / công cụ gán nhãn trên cloud | Ảnh có người thật; không đưa lên dịch vụ bên thứ ba |
| Git LFS cho dataset | Hạn mức gói miễn phí ~1–2 GB, không đủ cho 10–30 GB |

Thêm mục **"Những con số chưa tự đo được"**, liệt kê thẳng thứ đang dùng ước lượng hoặc trích dẫn thay vì số đo của nhóm — ví dụ những dòng còn mang nhãn *chưa xác minh* trong kế hoạch, hoặc các nhánh (TensorRT, nhánh C...) không chạy được vì lý do kỹ thuật.

---

### A4.7 Script tái lập `ml/scripts/reproduce.ps1`

**Làm gì.** Một script chạy **một lệnh** dựng lại toàn bộ kết quả từ repo sạch. Đây là thứ phân biệt "báo cáo có số" với "báo cáo kiểm chứng được", và là mục đắt giá nhất trong phần phụ lục.

**Cấu trúc:**

```powershell
# ml/scripts/reproduce.ps1
# Dựng lại toàn bộ kết quả báo cáo môn Xử lý ảnh.
# Dùng:  .\ml\scripts\reproduce.ps1 -Stage all
#        .\ml\scripts\reproduce.ps1 -Stage eval        # bỏ qua huấn luyện, dùng weights có sẵn
#        .\ml\scripts\reproduce.ps1 -Stage figures     # chỉ vẽ lại hình từ JSON đã có

param([ValidateSet("all","env","data","train","eval","figures")] [string]$Stage = "all")

# 0. env    — kiểm GPU, kiểm phiên bản gói khớp với ml/results/*/env.json
# 1. data   — dvc pull; tải VisDrone; chuyển sang 1 lớp person; sinh tập suy giảm (seed cố định)
# 2. train  — r01, r02, r03 (và r04/r05 nếu có dữ liệu thật)
# 3. eval   — evaluate.py + sahi_eval.py + export_and_bench.py + bench_restore.py
# 4. figures— make_figures.py
```

**Sáu yêu cầu bắt buộc của script:**

1. **Kiểm môi trường trước.** So `torch.__version__`, `ultralytics.__version__` và tên GPU với nội dung `ml/results/r02_*/env.json`. Khác thì **in cảnh báo rõ** (kết quả có thể lệch), không im lặng chạy tiếp.
2. **Seed cố định ở mọi bước.** Sinh tập suy giảm, chia tập, huấn luyện — tất cả `--seed 0`.
3. **Chạy được từng chặng.** Không ai muốn chạy lại 40 giờ huấn luyện chỉ để vẽ lại một cái hình.
4. **In thời gian ước tính từng chặng** trước khi bắt đầu, lấy từ `epoch_times.json` thật.
5. **Lỗi thì dừng**, không chạy tiếp rồi sinh kết quả nửa vời. `$ErrorActionPreference = "Stop"`.
6. **Ghi `ml/results/reproduce_log.txt`** — ngày chạy, chặng nào, thời gian, kết quả.

**Kiểm bằng cách chạy thật.** Một script tái lập chưa từng chạy hết là một lời hứa, không phải bằng chứng — đây đúng là kiểu "xanh mà không chứng minh gì". Tối thiểu phải chạy thật `-Stage eval` và `-Stage figures` từ đầu và xác nhận số ra **khớp** với số trong báo cáo. Nếu đủ thời gian thì chạy `-Stage all` một lần qua đêm; nếu không, **ghi rõ trong phụ lục là chỉ kiểm được hai chặng nào**.

`docs/bao-cao-xla/11-phu-luc-tai-lap.md` ghi: yêu cầu phần cứng, các bước cài (torch cu130 trước, rồi requirements), cách lấy dữ liệu (`dvc pull` hoặc tải VisDrone trực tiếp), lệnh chạy, thời gian ước tính từng chặng, và **những chặng nào đã được kiểm chứng chạy thật**.

**Kết quả mong đợi.** `.\ml\scripts\reproduce.ps1 -Stage figures` chạy sạch từ repo mới clone (sau `dvc pull`) và sinh hình khớp với hình trong báo cáo.

**Nếu lỗi:**

- Đường dẫn tuyệt đối lẫn trong script: thay bằng đường dẫn tương đối tính từ gốc repo. Script phải chạy được trên máy khác.
- `dvc pull` đòi quyền Google: ghi hướng dẫn trong phụ lục; hoặc kèm tập con nhỏ để chạy thử.
- Kết quả chạy lại lệch nhẹ so với báo cáo: bình thường với GPU (một số kernel CUDA không tất định). Ghi rõ mức lệch chấp nhận được trong phụ lục thay vì giả vờ là khớp tuyệt đối.

---

### A4.8 Giấy phép, trích dẫn, kiểm URL

**Làm gì.** Ba việc nhỏ nhưng mất điểm nặng nếu bỏ.

**Mục giấy phép** (lấy từ `ml/data/README.md` và `ml/restore/WEIGHTS.md`), ghi nguyên văn sự mơ hồ chứ đừng làm tròn:

- **VisDrone**: repo gốc **không có file LICENSE**; trang dataset của Ultralytics hiển thị "No license". Là benchmark học thuật lâu đời và theo thông lệ được dùng tự do cho nghiên cứu, **nhưng không có văn bản cho phép phát hành lại**. Nhóm trích dẫn bài báo gốc, không đăng lại ảnh thô, không giả định quyền thương mại.
- **HERIDAL**: CC BY — bắt buộc ghi công tác giả.
- **Zero-DCE**: CC BY-NC 4.0 — **chỉ nghiên cứu phi thương mại**. Dùng trong đồ án là hợp lệ, phải khai.
- **Real-ESRGAN** BSD-3-Clause; **FBCNN** Apache-2.0; **NAFNet**, **SCI**: ghi đúng nội dung LICENSE đã đọc trong repo (nếu chưa đọc được thì ghi *chưa xác minh*, đừng đoán).
- **albumentations** 2.0.8 (MIT) — ghi lý do ghim: gói gốc ngừng bảo trì ở tag này; bản kế nhiệm `albumentationsx` là AGPL-3.0.
- **Ảnh người thật**: đã xin phép; che mặt trong mọi ảnh minh hoạ; không lưu trên dịch vụ cloud công cộng.

**Trích dẫn.** Nguồn đã kiểm chứng nằm ở §8 của `plans/reports/260921-research-ai-vision-pipeline.md`. **§9 của file đó là danh sách URL CHƯA kiểm chứng** — mở từng cái trong trình duyệt trước khi đưa vào tài liệu tham khảo, hoặc bỏ. Đặc biệt: trang `pytorch.org/get-started/locally/` trả về nội dung cũ khi fetch tự động — không lấy số phiên bản từ đó.

**Kiểm URL.** Trước khi nộp, kiểm mọi URL trong §10 còn sống. Thêm `[truy cập ngày YYYY-MM-DD]` sau mỗi link.

**Hai con số phải sửa cho đúng nếu trích từ tài liệu tổng quan:** fps VGA của camera là **14.19** (số đo), không phải "15–25"; và mô tả về "bản IPEX" trong tài liệu tổng quan mô tả sai cơ chế (đế u.FL có sẵn trên mạch, chuyển anten là hàn lại một điện trở 0 Ω, không phải mua SKU khác).

**Kết quả mong đợi.** §10 chỉ chứa nguồn đã tự mở; mục giấy phép đầy đủ; không URL nào 404.

---

### A4.9 Xuất bản, demo và kiểm cuối

**Làm gì.** Ghép các chương thành một tài liệu theo đúng định dạng giảng viên yêu cầu, chuẩn bị demo, và chạy checklist cuối.

**Xuất.** Viết từng chương bằng Markdown (dễ diff, dễ sửa), ghép và xuất bằng `pandoc` sang DOCX hoặc PDF. Ghi lệnh xuất vào `docs/bao-cao-xla/README.md` để lần sau không phải nhớ lại.

**Kịch bản demo (5–10 phút), nếu giảng viên yêu cầu:**

1. Một ảnh từ camera rẻ và một ảnh từ điện thoại, cùng cảnh, đặt cạnh nhau — thấy ngay vấn đề.
2. Chạy phát hiện trên ảnh xấu → kết quả kém. Bật bộ khôi phục → kết quả đổi thế nào (**kể cả khi không cải thiện** — đó chính là luận điểm).
3. Hình `fig08` (PSNR ngang mAP dọc) — một hình nói hết câu chuyện.
4. Nếu bay được: video ngắn drone bay, khung phát hiện hiện trên web.
5. Nêu một hạn chế và một hướng phát triển — cho thấy nhóm hiểu giới hạn của mình.

Chuẩn bị **bản ghi màn hình dự phòng** cho phần demo trực tiếp: Wi-Fi hội trường thường không như ở nhà.

**Checklist cuối cùng:**

- [ ] Mọi con số trong báo cáo truy ngược được về một file trong `ml/results/`.
- [ ] **Mọi bảng kết quả có cột AR-small.**
- [ ] Không chỗ nào viết "độ chính xác 90–95%" hay tương tự.
- [ ] Số seed được ghi rõ ở mọi so sánh.
- [ ] Trích dẫn SAHI ghi rõ detector là FCOS.
- [ ] Số đo tốc độ kèm GPU, batch, imgsz, backend, driver.
- [ ] §07 và §09 tồn tại và có nội dung thật, không phải một dòng lấy lệ.
- [ ] Mục giấy phép đủ, kể cả phần "chưa xác minh".
- [ ] Mọi URL đã mở kiểm, có ngày truy cập.
- [ ] `reproduce.ps1` đã chạy thật ít nhất hai chặng; phụ lục ghi rõ chặng nào đã kiểm.
- [ ] Ảnh minh hoạ có người thì **đã che mặt**.
- [ ] Đọc to một đoạn bất kỳ ở mỗi chương — nghe giống người viết, không giống máy sinh.

---

## Cổng pass

- [ ] `docs/bao-cao-xla/README.md` ghi đề tài đã chốt, câu hỏi nghiên cứu **một câu**, và yêu cầu của giảng viên.
- [ ] Đủ 12 file chương; §07 (đe doạ tính hợp lệ) có ≥ 8 mục; §09 (những gì không làm) có ≥ 6 mục kèm lý do.
- [ ] `python ml\scripts\make_figures.py` sinh **toàn bộ** hình trong một lần chạy; không hình nào vẽ tay hay chụp màn hình.
- [ ] Mọi bảng kết quả có cột **AR-small**; không chỗ nào có con số kiểu "độ chính xác 95%".
- [ ] Mục "kỳ vọng trung thực" nằm ở đầu §05 với baseline 21.9% / 11.7% và mục tiêu 30–45%.
- [ ] Mỗi con số truy ngược được về file trong `ml/results/` (soát ngẫu nhiên 10 con số để kiểm).
- [ ] `ml/scripts/reproduce.ps1` chạy thật được `-Stage figures` và `-Stage eval`; `reproduce_log.txt` có bằng chứng; phụ lục ghi rõ chặng nào chưa kiểm được.
- [ ] Mục giấy phép ghi đủ VisDrone (không LICENSE), HERIDAL (CC BY), Zero-DCE (CC BY-NC), albumentations (MIT + lý do ghim).
- [ ] Mọi URL trong §10 đã tự mở, có `[truy cập ngày ...]`; không dùng nguồn nào còn nằm ở danh sách "chưa kiểm chứng".
- [ ] Ảnh minh hoạ có người đã che mặt; `nhat-ky-thu-du-lieu.md` có ghi sự đồng ý.
- [ ] Xuất được ra định dạng giảng viên yêu cầu; kịch bản demo và bản ghi màn hình dự phòng đã sẵn sàng.

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Kết quả không như kỳ vọng → bị cám dỗ viết đẹp hơn sự thật | 3 | 5 | **15** | Sáu luật viết kết quả ở A4.4; mọi con số phải truy ngược về file; **kết quả âm vẫn báo cáo** — một giả thuyết bị bác bỏ là kết quả khoa học |
| Hình vẽ tay lệch với bảng sau khi chạy lại số liệu | 3 | 4 | **12** | `make_figures.py` sinh mọi hình từ JSON; cấm chụp màn hình bảng |
| `reproduce.ps1` viết xong nhưng chưa từng chạy hết → là lời hứa, không phải bằng chứng | 4 | 3 | **12** | Bắt buộc chạy thật ≥ 2 chặng; ghi `reproduce_log.txt`; phụ lục ghi rõ chặng nào chưa kiểm |
| Trích dẫn nguồn chưa kiểm chứng (§9 báo cáo nghiên cứu) | 3 | 3 | **9** | Mở từng URL trước khi đưa vào §10; thêm ngày truy cập; bỏ nguồn không mở được |
| Yêu cầu của giảng viên khác với giả định (định dạng, số trang, kiểu trích dẫn) | 3 | 3 | **9** | Hỏi ở A4.0, **trước** khi viết; ghi câu trả lời vào README |
| Thiếu số liệu cho một bảng vì AI Phase 3 bỏ bước | 3 | 3 | **9** | Mỗi ô trống ghi rõ **lý do** ở §09; không để ô trống không giải thích |
| Vi phạm riêng tư người trong ảnh | 2 | 5 | **10** | Che mặt mọi ảnh minh hoạ; kiểm lại trước khi xuất bản; đã có ghi nhận đồng ý |
| Demo trực tiếp hỏng vì Wi-Fi hội trường | 3 | 2 | **6** | Bản ghi màn hình dự phòng; demo trên dữ liệu đã lưu sẵn |
| Viết trễ, dồn vào tuần cuối | 3 | 4 | **12** | Viết §03 và §04 **song song** với AI Phase 3 (phương pháp không đợi kết quả); §05 chỉ điền số khi có |
| Văn phong đọc như máy sinh | 3 | 2 | **6** | Đọc to từng đoạn; câu ngắn, chủ ngữ rõ; tránh mở bài sáo rỗng và kết đoạn tóm tắt lặp lại |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| A4.0 Chốt phạm vi + hỏi yêu cầu giảng viên | 1.5 | Thời gian chờ giảng viên trả lời nằm ngoài |
| A4.1 Khung chương + bản đồ bảng/hình | 2.0 | Làm trước, tiết kiệm gấp nhiều lần lúc viết |
| A4.2 `make_figures.py` + 10 hình | 5.0 | |
| A4.3 Viết §03 Phương pháp + §04 Dữ liệu | 6.0 | **Viết được song song với AI Phase 3** |
| A4.4 Viết §05 Kết quả + §06 Bàn luận | 5.0 | |
| A4.5 §07 Đe doạ tính hợp lệ | 2.0 | |
| A4.6 §09 Những gì không làm | 1.5 | |
| A4.7 `reproduce.ps1` + chạy kiểm thật | 4.0 | **+ ~2 giờ GPU** cho chặng eval |
| A4.8 Giấy phép, trích dẫn, kiểm URL | 2.0 | |
| A4.9 Xuất bản + demo + checklist cuối | 3.0 | |
| **Tổng** | **~28 giờ người** | **+ ~2 giờ GPU** |

Đường găng: A4.0 → A4.1 → A4.2 → A4.4 → A4.9. **A4.3 (§03 + §04) làm được song song với AI Phase 3** vì phương pháp và mô tả dữ liệu không đợi kết quả — tận dụng điều này để không dồn việc vào tuần cuối.

## Ghi chú cho sổ tay

Để agent viết `docs/so-tay/ai-04-bao-cao-xla.md`:

**Về cấu trúc một báo cáo khoa học**

- Vì sao có **câu hỏi nghiên cứu** chứ không chỉ "làm một hệ thống". Ví dụ: "em làm app nhận diện người" là mô tả sản phẩm; "khôi phục ảnh có thật sự giúp máy nhận ra người không, hay chỉ làm ảnh đẹp với mắt người" là câu hỏi.
- *Phương pháp vs Kết quả vs Bàn luận* — ba chương ba việc khác nhau; trộn chúng là lỗi phổ biến nhất.
- *Vì sao Kết quả chỉ được trình bày số, không diễn giải* — tách ra thì người đọc phân biệt được đâu là dữ liệu, đâu là ý kiến của nhóm.

**Về tính trung thực**

- *Threats to validity (đe doạ tính hợp lệ)* — tự nói ra chỗ mình có thể sai. Nghe như tự bắn vào chân nhưng thực ra làm báo cáo mạnh hơn: người chấm đằng nào cũng nghĩ ra, nêu trước cho thấy mình hiểu việc mình làm.
- *Kết quả âm (negative result)* — "thứ này không giúp" là một phát hiện, không phải thất bại. Nhất là khi tài liệu đang có hai đáp án trái ngược.
- *Vì sao cấm viết "độ chính xác 95%"* — không nói rõ chỉ số gì, trên tập nào, ngưỡng nào thì con số đó không có nghĩa, và người có kinh nghiệm sẽ nhận ra ngay.
- *Biến nhiễu (confounder)* — thu ba độ cao vào ba buổi trời khác nhau thì không biết chênh lệch do độ cao hay do nắng.

**Về tái lập**

- *Reproducibility* — người khác chạy lại có ra kết quả tương tự không. Vì sao seed, phiên bản gói, và phiên bản driver đều phải ghi.
- *Vì sao GPU không cho kết quả tất định tuyệt đối* và mức lệch nào là chấp nhận được.
- *Một script tái lập chưa từng chạy hết là một lời hứa, không phải bằng chứng.*

**Về hình và bảng**

- Vì sao hình phải sinh bằng script chứ không vẽ tay hay chụp màn hình.
- Caption tốt: ghi rõ tập dữ liệu, số mẫu, đơn vị trục.
- Hình phải đọc được khi in đen trắng.

**Về cách viết**

- Câu ngắn, chủ ngữ rõ, hạn chế câu bị động.
- Tránh mở bài sáo rỗng và kết đoạn tóm tắt lại chính đoạn vừa viết.
- Đọc to: nghe không giống người nói thì viết lại.
