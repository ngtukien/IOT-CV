# Phase 18: Lắp ráp khung S500 — hàn nguồn, nối dài dây motor, bát chống rung, đi dây, CG

| Trạng thái | Phụ thuộc | Ước lượng | Cần phần cứng |
|---|---|---|---|
| chưa bắt đầu | Phase 17 | ~16 giờ | Có (toàn bộ: khung S500, stack F405 V5 + OX32, 4 motor AIR2216 + cánh T1045, GPS M10, iA6B, TFmini Plus, ESP32 DevKit, board camera, UBEC 5V 3A, pin 4S, XT60, tụ 1000µF, dây 16AWG, gen co, dây rút, băng keo xốp 3M VHB, mỏ hàn 60 W, đồng hồ vạn năng, lục giác, túi chống cháy LiPo) |

## Mục tiêu

Phase này biến đống linh kiện đã test rời trên bàn (Phase 14–17) thành **một chiếc drone hoàn chỉnh về cơ khí và điện, chưa gắn cánh**. Kết thúc phase: khung đã lắp, 4 motor đã bắt lên cần và nối dài dây, nguồn đã hàn và đã đo không chập, bo bay nằm trên bát chống rung đúng hướng mũi tên, GPS/receiver/TFmini/ESP32/camera đã có chỗ cố định, dây đã đi gọn, trọng tâm đã cân, và toàn bộ khối lượng thật đã được cân và ghi lại.

Phase này **không cấp điện cho drone** (trừ đúng một lần đo continuity bằng đồng hồ, không có pin). Mọi việc hiệu chỉnh, bật nguồn và test motor thuộc Phase 19.

> **AN TOÀN — luật xuyên suốt phase này: KHÔNG CÓ CÁNH TRÊN BÀN.** Cánh T1045 để nguyên trong hộp, cất ở ngăn khác, cho tới Phase 19 mục 19.13. Xem `SAFETY.md` mục 2.

## Đầu vào cần có

Phải đọc trước:

- `SAFETY.md` — toàn bộ. Đặc biệt mục 2 (NO PROPELLERS), mục 6 (pin LiPo), mục 7 (nguồn điện: đo continuity trước khi cắm pin lần đầu).
- `plans/reports/260921-brainstorm-thiet-ke-tong-the.md` — mục 3 (sơ đồ kiến trúc, bảng phân bổ SERIAL) và mục 6 (bảng rủi ro).
- `params/obstacle-avoidance-tfminiplus-serial3.param` — phần chú thích đầu file: **bảng phân bổ nguồn 5V** (BEC của stack nuôi GPS + iA6B + TFmini; UBEC riêng nuôi 2 con ESP32) và bảng màu dây TFmini Plus.
- `docs/bao-cao-tong-quan-du-an.md` mục 3.2 — bảng khối lượng và phân tích lực đẩy (dùng để đối chiếu ở mục 18.14).
- Checklist đấu dây từng connector của F405 V5 và sơ đồ bố trí khung, đã in ra giấy ở Phase 13.
- Ảnh kiểm hàng chụp ở Phase 14 (để đối chiếu linh kiện nào là linh kiện nào).

Phải có sẵn và đã pass:

- Phase 17 đã xong: web GCS hiện telemetry thật của bo bay trên bàn, TFmini đọc được số trên Mission Planner, ESP32 bridge lên SERIAL2 chạy, camera stream về laptop. Tức là **mọi linh kiện đều đã được chứng minh là còn sống trước khi bị bắt vít vào khung**. Không lắp một linh kiện chưa từng chạy.
- Bàn làm việc phẳng, đủ sáng, có chỗ để đồng hồ vạn năng và mỏ hàn mà không vướng.
- Túi chống cháy LiPo, và pin 4S đang **để trong túi, chưa lấy ra**.

## File và thư mục sở hữu

Phase này được tạo/sửa đúng những đường dẫn sau. Không đụng gì khác.

Tạo mới:

- `docs/so-tay/18-lap-rap-khung.md` — sổ tay người mới cho phase này.
- `docs/so-tay/anh/18/` — thư mục ảnh checklist lắp ráp (xem mục 18.15). Thêm dòng `docs/so-tay/anh/**/*.jpg` vào `.gitignore` nếu ảnh vượt 5 MB/tấm; mặc định nén xuống ≤ 1 MB rồi commit.
- `docs/do-dac/18-can-khoi-luong.md` — bảng khối lượng cân thật, đối chiếu với `docs/bao-cao-tong-quan-du-an.md` mục 3.2.

Sửa:

- `plans/PROGRESS.md` — tick checkbox của Phase 18.

**Không đụng:** `firmware/`, `backend/`, `frontend/`, `ml/`, `params/`, `plans/reports/`, `SAFETY.md`, `docs/bao-cao-tong-quan-du-an.md`. Nếu số cân thật lệch nhiều so với bảng 3.2, **ghi vào file `docs/do-dac/18-can-khoi-luong.md`** và báo lại, không tự sửa báo cáo tổng quan.

## Việc theo thứ tự

### 18.1 Dọn bàn, dán nhãn, quy tắc chung

Trước khi vặn con ốc đầu tiên, dọn một mặt bàn trống hoàn toàn, trải một tấm giấy trắng hoặc thảm silicone. Linh kiện nhỏ của bộ S500 (ốc M3, ốc M2.5, đệm) rất dễ lăn mất và **không có sẵn ở cửa hàng ốc vít thường**.

Chia sẵn 5 cái đĩa/hộp nhỏ, dán nhãn: `ốc khung`, `ốc motor`, `ốc stack`, `dây rút`, `đồ thừa`.

Ba quy tắc áp cho cả phase:

- **Pin 4S nằm trong túi chống cháy, ở một bàn khác.** Không để pin trên bàn lắp ráp. Lý do: chỉ cần một lần vô ý gạt tay là đầu XT60 chạm vào mạt thiếc.
- **Không siết chặt hết cỡ ở lần đầu.** Vặn tay tới khi chớm chặt, lắp hết rồi mới siết vòng hai. Siết chặt từng cái một làm khung vênh.
- **Mỗi lần hàn xong một mối là đo continuity ngay**, không để dồn 12 mối rồi mới đo — lúc đó không biết mối nào sai.

> **AN TOÀN:** Mỏ hàn 60 W đang nóng là nguồn gây cháy. Luôn đặt vào đế, không đặt trên bàn. Rút điện khi rời bàn quá 5 phút.

**Kết quả mong đợi:** bàn trống, 5 hộp có nhãn, pin không có mặt trên bàn.

### 18.2 Lắp khung: cần (arm) → chân đáp → tấm trên

Thứ tự bắt buộc là **cần trước, chân đáp sau, tấm trên cuối cùng** — vì ốc bắt cần và ốc bắt chân đáp đều đi xuyên qua tấm đế, mà tấm trên lắp vào rồi thì không còn chỗ luồn lục giác.

1. Đặt **tấm đế** (tấm dày, có các điểm hàn đồng và ký hiệu `+` `−`) ngửa lên bàn.
2. Bắt lần lượt 4 **cần** vào tấm đế. Mỗi cần thường có 2–4 ốc M3. Vặn chớm, chưa siết.
3. Bắt 2 **chân đáp** vào hai cần chéo nhau (thường là hai cần sau). Chân đáp S500 có một thanh ngang gắn vào thân cần.
4. Đặt **tấm trên** lên, bắt ốc quanh chu vi. Đây là tấm sợi thuỷ tinh trơn, không có mạch.
5. Siết vòng hai: đi theo đường chéo (cần 1 → cần 3 → cần 2 → cần 4), mỗi cái siết thêm một chút, lặp 2 vòng.

**Kiểm tra khung ngay sau khi siết xong:**

- Đặt khung xuống mặt bàn phẳng. **Cả 4 đầu cần (chỗ bắt motor) phải cùng nằm trên một mặt phẳng.** Cách kiểm tra: ấn nhẹ lên từng đầu cần — nếu khung bập bênh, một cần bị vênh.
- Nhìn dọc từ đầu cần vào tâm: cần không được cong.
- Lắc nhẹ từng cần: không được có độ rơ.

> **AN TOÀN — CẤM KHOAN TẤM ĐẾ.** Tấm đế S500 **không phải tấm nhựa trơn**: nó là bo phân phối nguồn (PDB) tích hợp, có các đường đồng đúc **chìm bên trong lớp vật liệu**, dẫn dòng liên tục 60 A / đỉnh 100 A từ pin ra 4 điểm hàn ESC. Khoan trúng đường đồng thì đứt mạch nguồn và **không dò được bằng mắt**; mạt đồng bám thành lỗ thì gây chập chờn — lúc đầu vẫn chạy, nóng lên mới chập, và lúc đó drone đang ở trên không. Quy tắc nhận biết: **tấm nào có điểm hàn đồng và ký hiệu cực `+` `−` thì tuyệt đối không khoan.** Bản dựng này **không cần khoan lỗ nào cả** — xem mục 18.8. (Nguồn: nháp cũ GIAI ĐOẠN 26; trang sản phẩm Holybro xác nhận PDB tích hợp.)

**Nếu lỗi:**

- *Ốc không vào ren, phải dùng lực:* sai cỡ ốc. S500 dùng cả M3 và M2.5 — thử con khác, không ép. Ép một vòng là tước ren nhựa và mất luôn điểm bắt đó.
- *Khung bập bênh:* nới toàn bộ ốc của cần bị vênh, đặt khung lên mặt phẳng, ấn giữ rồi siết lại.
- *Chân đáp lỏng dù đã siết hết:* thiếu đệm vênh. Thêm đệm, hoặc một giọt keo khoá ren loại xanh (tháo được), tuyệt đối không dùng loại đỏ.

### 18.3 Xác định vị trí M1–M4 và chiều ren của từng motor

Đây là bước **dễ làm sai nhất trong cả phase** và hậu quả là drone lật ngay khi cất cánh. Làm chậm.

Quy ước motor của ArduPilot cho khung **Quad X** (`FRAME_CLASS,1` + `FRAME_TYPE,1` trong `01-base.param`), nhìn **từ trên xuống, mũi drone hướng ra xa người nhìn**:

```text
        MŨI (hướng mũi tên FC)
   M3 (trước-trái)      M1 (trước-phải)
        CW                   CCW
             \     /
              \   /
               \ /
               / \
              /   \
             /     \
        CCW                  CW
   M2 (sau-trái)        M4 (sau-phải)
        ĐUÔI
```

- M1 = trước-phải, quay **CCW** (ngược kim đồng hồ)
- M2 = sau-trái, quay **CCW**
- M3 = trước-trái, quay **CW** (thuận kim đồng hồ)
- M4 = sau-phải, quay **CW**

Dán băng dính giấy lên từng cần và **viết `M1` `M2` `M3` `M4` bằng bút dạ ngay bây giờ**. Đừng nghĩ "sau nhớ được" — bạn sẽ không nhớ (nháp cũ GIAI ĐOẠN 27).

**Chiều ren của motor AIR GEAR 450 II — phải phân loại trước khi bắt vít.** Bộ AIR GEAR 450 II gồm **2 motor ren phải + 2 motor ren trái**: trục M6 có ren, cánh T1045 vặn thẳng lên trục và **tự siết theo chiều quay**. Hệ quả: một motor chỉ đứng được ở vị trí mà chiều quay của nó làm cánh siết chặt vào, không phải nới ra.

Cách phân loại bằng tay, không cần điện:

1. Lấy 4 motor ra, để trước mặt.
2. Lấy một cánh T1045 **bất kỳ**, thử vặn bằng tay lên trục từng motor. Vặn nhẹ nhàng — **nếu phải dùng lực thì đó là sai cặp, dừng lại ngay**.
3. Cánh vào ngọt ở 2 motor và không vào ở 2 motor còn lại. Đó là hai nhóm ren.
4. Ghi nhãn: nhóm nào nhận cánh vặn theo chiều kim đồng hồ (ren phải, ren thường) là nhóm **CCW** — tức là M1 và M2. Nhóm nhận cánh vặn ngược chiều kim đồng hồ (ren trái) là nhóm **CW** — tức là M3 và M4.

> **Lý do (chưa xác minh trên phần cứng thực tế, đây là suy luận cơ học — phải kiểm chứng lại bằng tay ở mục 19.13):** cánh bị lực cản không khí kéo lại phía sau so với trục, nên so với trục thì cánh có xu hướng quay **ngược** chiều quay của motor. Với ren phải (siết khi vặn theo chiều kim đồng hồ), xu hướng đó làm siết chặt khi trục quay **CCW**. Vì vậy motor ren phải đi với vị trí CCW (M1, M2), motor ren trái đi với vị trí CW (M3, M4). Hãng thường khắc vạch hoặc chữ trên đai ốc/trục của loại ren trái — tìm ký hiệu đó và đối chiếu với kết luận trên trước khi tin.

**Kết quả mong đợi:** 4 cần đã dán nhãn M1–M4; 4 motor đã chia thành 2 nhóm ren và mỗi motor đã được gán một vị trí.

**Nếu lỗi:**

- *Cả 4 motor đều nhận cùng một cánh:* bạn đang thử nhầm loại cánh, hoặc bộ hàng giao sai (4 motor cùng chiều ren). Đếm lại: phải đủ **2+2**. Nếu không đủ, dừng phase và liên hệ shop — đây là lỗi hàng, không tự xử lý được.
- *Không phân biệt được cánh CW và CCW:* xem mục 19.13, ở đó có cách nhận dạng bằng cạnh trước của cánh. Ở bước này chỉ cần biết "cánh này vào motor này được hay không".

### 18.4 Bắt motor lên cần

Mỗi motor AIR2216II bắt bằng 4 ốc M3 vào lỗ 16×19 mm ở đầu cần, trùng chuẩn 22xx nên vặn thẳng lên được, không cần bát chuyển.

1. Luồn dây motor **xuống dưới, vào trong lòng cần** trước khi bắt ốc. Sau khi bắt xong rất khó luồn lại.
2. Đặt motor sao cho **cổng ra dây hướng vào trong tâm khung**, không hướng ra ngoài.
3. Bắt 4 ốc theo đường chéo, siết đều.
4. Kiểm tra: xoay trục motor bằng tay — phải quay trơn, không cà, không lệch tâm nhìn thấy được.

> **AN TOÀN:** Kiểm tra **độ dài ốc**. Ốc M3 dài quá sẽ chạm vào cuộn dây bên trong motor, làm chập cuộn — motor cháy hoặc khựng giữa không trung. Quy tắc: ốc vặn vào phải còn dư ít nhất 1 mm so với đáy lỗ ren của motor. Nếu ốc đi kèm khung dài hơn ốc đi kèm motor, **dùng ốc đi kèm motor**.

**Kết quả mong đợi:** 4 motor chắc, quay trơn bằng tay, dây đi trong lòng cần, nhãn M1–M4 vẫn đọc được.

**Nếu lỗi:**

- *Motor quay có tiếng cà:* thường do ốc quá dài chạm cuộn dây, hoặc rơi mạt kim loại vào khe từ. Tháo ra, thổi sạch, thay ốc ngắn hơn.
- *Đầu cần nứt khi siết:* siết quá tay vào nhựa. Đổi sang đệm rộng bản để trải lực, và không siết quá mức chớm chặt + 1/4 vòng.

### 18.5 Nối dài dây motor bằng dây 16AWG — 12 mối hàn

Motor nằm ở đầu cần dài 480 mm, ESC 4-in-1 nằm ở tâm khung, nên dây motor gốc **không đủ dài**: phải nối dài mỗi sợi khoảng 30 cm. 4 motor × 3 sợi = **12 mối hàn**, tổng khoảng 3,6 m dây 16AWG (con số 3,6 m lấy từ `docs/bao-cao-tong-quan-du-an.md` mục 3.2).

Vì sao 16AWG: cả drone rút khoảng 58 A ở ga đầy, chia cho 4 motor là ~15 A mỗi sợi; 16AWG dư biên cho dòng đó ở chiều dài 30 cm. Không dùng dây mỏng hơn "cho dễ hàn".

**Kỹ thuật, làm lần lượt từng sợi một:**

1. **Cắt** 12 đoạn 16AWG dài 30 cm. Cắt luôn 12 đoạn gen co: 8 đoạn nhỏ (bọc từng mối, dài 25 mm) + 4 đoạn to (bọc cả bó 3 sợi của một motor, dài 60 mm). *Luồn gen co vào dây TRƯỚC khi hàn* — quên bước này là phải cắt mối hàn ra làm lại, và ai cũng quên ít nhất một lần.
2. **Tuốt** 6–8 mm mỗi đầu. Dùng kìm tuốt đúng cỡ 16AWG; dao rọc giấy sẽ cắt đứt vài sợi đồng và làm nóng chỗ đó khi chạy dòng.
3. **Mạ thiếc (tin) cả hai đầu riêng rẽ.** Mỏ hàn đặt 380–400 °C, đầu hàn loại vát (chisel), lau sạch. Áp mỏ hàn vào **sợi đồng**, đợi 2–3 giây cho đồng nóng lên, rồi mới đưa thiếc vào **phía đối diện mỏ hàn** — thiếc phải chảy vì *đồng nóng*, không phải vì *chạm mỏ hàn*. Đầu dây mạ xong phải bóng, ngấm đều, không vón cục.
4. **Nối kiểu bắt tay (lap splice):** đặt hai đầu đã mạ **song song chồng lên nhau** khoảng 6 mm (không đấu đầu-đối-đầu — mối đấu đầu dễ gãy khi rung). Kẹp cố định bằng kẹp cá sấu hoặc "bàn tay thứ ba". Áp mỏ hàn vào chỗ chồng, hai lớp thiếc sẽ chảy hoà vào nhau trong 2–3 giây. Rút mỏ hàn, **giữ yên 5 giây cho nguội** — rung tay lúc đang đông là ra "mối hàn nguội".
5. **Kiểm tra mối bằng mắt và bằng tay:** mối hàn tốt thì **bóng, mượt, thấy rõ hình sợi đồng bên trong**. Mối hàn nguội thì **xỉn, sần, vón như hạt gạo**. Kéo thử bằng tay với lực vừa phải: không được tuột, không được dão.
6. **Co gen:** đẩy gen nhỏ lên trùm kín mối, dùng máy sấy hoặc thân mỏ hàn (không phải đầu) làm co. Gen phải trùm qua mối ít nhất 5 mm mỗi bên.
7. Làm xong 3 sợi của một motor thì **đẩy gen to trùm cả bó 3 sợi** — vừa gọn vừa chống cọ xát vào cần.

> **AN TOÀN:** Mỏ hàn 60 W là **mức tối thiểu** cho dây 16AWG. Nếu áp mỏ hàn 8–10 giây mà thiếc vẫn chưa chảy thành giọt bóng thì **đừng cố kéo dài**: nhiệt đang thoát hết vào dây, bạn chỉ đang nung chảy vỏ cách điện. Dừng lại, để nguội, thêm nhựa thông (flux), lau sạch đầu hàn, thử lại. Vẫn không được thì mượn mỏ hàn 80–100 W. Một mối hàn nguội trên dây motor gây **desync** (motor đang quay thì khựng) — trên không, desync một motor là rơi.

**Kiểm tra bắt buộc sau mỗi motor (3 mối), bằng đồng hồ vạn năng ở chế độ continuity (biểu tượng sóng âm):**

```text
Đo 1 — thông mạch từng pha:
  que đo A -> đầu dây phía motor (pha 1)
  que đo B -> đầu dây phía ESC   (pha 1)
  KẾT QUẢ ĐÚNG: kêu bíp, điện trở ~0 Ω. Lặp cho pha 2, pha 3.

Đo 2 — không chập giữa các pha (đo khi CHƯA cắm vào ESC):
  pha 1 <-> pha 2, pha 2 <-> pha 3, pha 1 <-> pha 3
  KẾT QUẢ ĐÚNG với motor brushless: CÓ kêu bíp / điện trở rất nhỏ (vài phần Ω)
  — vì 3 cuộn dây nối sao bên trong motor. ĐÂY KHÔNG PHẢI LỖI.
  Con số quan trọng là 3 giá trị phải BẰNG NHAU. Lệch nhau rõ rệt = một mối hàn xấu.

Đo 3 — không chạm vỏ / không chạm cần:
  từng pha  <->  thân motor (vỏ kim loại)
  từng pha  <->  ốc bắt cần
  KẾT QUẢ ĐÚNG: KHÔNG kêu, đồng hồ báo hở mạch (OL / 1).
  Nếu kêu: gen co bị thủng hoặc mối hàn chạm khung -> làm lại mối đó.
```

**Kết quả mong đợi:** 12 mối hàn bóng, đã bọc gen, 4 bó dây gọn, cả 3 phép đo trên đều đúng cho cả 4 motor.

**Nếu lỗi:**

- *Ba pha lệch điện trở nhau nhiều:* mối hàn nguội ở pha có điện trở cao. Cắt ra hàn lại, không "hàn đè thêm thiếc lên".
- *Đo pha chạm vỏ motor:* dây bên trong motor đã bị ốc M3 quá dài đâm thủng (mục 18.4). Tháo motor, kiểm tra ốc.
- *Vỏ dây co lại và cháy đen quanh mối:* nhiệt quá lâu. Mối đó vẫn có thể thông nhưng cách điện đã yếu — cắt bỏ, làm lại.

### 18.6 Hàn XT60 và dây nguồn ESC 4-in-1 lên bo đế S500 + tụ 1000 µF

Tấm đế S500 là bo phân phối nguồn (PDB) tích hợp, liên tục 60 A / đỉnh 100 A. Nó có **cặp pad nguồn chính ở giữa** (ký hiệu `+` và `−`, hoặc `BAT+` / `BAT−`) và **4 cặp pad nhỏ hơn** toả ra 4 phía cho 4 ESC rời kiểu cũ. Bản dựng này dùng ESC 4-in-1 nên chỉ dùng cặp pad giữa và một cặp pad ESC.

> **Kiểm tra hộp trước khi hàn.** Stack SpeedyBee thường **đã có sẵn một sợi XT60 để hàn thẳng vào pad `BAT+`/`BAT−` của ESC**. Nếu sợi đó đủ dài để đi từ vị trí đặt pin tới stack, hãy dùng đúng nó và **bỏ qua bước hàn lên PDB** (nháp cũ GIAI ĐOẠN 28 làm theo cách này) — ít một điểm nối là ít một điểm hỏng. Chỉ hàn lên PDB khi sợi có sẵn quá ngắn, hoặc khi bạn muốn PDB làm điểm đấu để sau này lấy thêm nguồn cho UBEC. Đây là nhánh rẽ theo **thực tế trong hộp**, không phải một lựa chọn thiết kế còn bỏ ngỏ.

**Nếu hàn lên PDB, thứ tự đúng là:**

1. **Nhận diện cực.** Nhìn kỹ ký hiệu `+` `−` in trên tấm đế. Chụp ảnh lại trước khi hàn — sau khi phủ thiếc sẽ không đọc được nữa. **Đấu ngược cực là hỏng toàn bộ stack 2 triệu ngay lần cắm pin đầu tiên, không có cầu chì nào cứu.**
2. **Mạ thiếc pad trước (pre-tin).** Pad đồng của PDB to và tản nhiệt rất nhanh — đây là chỗ mỏ hàn 60 W đuối nhất. Đặt 400 °C, đầu vát to, chấm một ít nhựa thông lên pad, áp mỏ hàn **dí sát và giữ yên**, đợi 4–6 giây rồi đưa thiếc vào. Mục tiêu: một gò thiếc nhỏ, bóng, phủ kín pad. Nếu sau 10 giây thiếc vẫn vón trên bề mặt mà không loang ra — dừng, để nguội hoàn toàn (60 giây), thêm flux, thử lại.
3. **Mạ thiếc đầu dây** (dây XT60 và dây nguồn ESC) như mục 18.5.
4. **Ghép:** đặt đầu dây đã mạ lên gò thiếc trên pad, áp mỏ hàn từ **phía trên dây**, cả hai lớp thiếc chảy hoà vào nhau trong 3–4 giây. Rút mỏ hàn, giữ dây **tuyệt đối yên 8–10 giây** (thiếc trên pad to nguội chậm hơn nhiều so với mối nối dây).
5. **Hàn dây đen (âm) trước, dây đỏ (dương) sau.** Nếu mỏ hàn trượt lúc đang hàn dây đỏ mà dây đen đã xong thì chỉ chập tạm; ngược lại thì dây đỏ tự do dễ quệt vào pad âm.
6. **Hàn tụ 1000 µF 35 V** (hộp Deluxe có sẵn 2 cái) vào **pad `BAT+`/`BAT−` của chính ESC**, càng sát ESC càng tốt — không hàn ở PDB. Tụ phải nằm ở đầu dây gần ESC thì mới hấp thụ được xung điện áp lúc đóng cắt, đó là tác dụng duy nhất của nó.

> **AN TOÀN — tụ có cực.** Chân **dài là `+`**, chân **ngắn là `−`**, và thân tụ có **vạch dọc đánh dấu chân `−`**. Lắp ngược là **nổ tụ**: vỏ nhôm bung, bắn điện phân. Đeo kính bảo hộ ở lần cắm pin đầu tiên (Phase 19). Không lắp tụ thì xung điện áp lúc đóng cắt **có thể giết FC** (nháp cũ GIAI ĐOẠN 28).

> **AN TOÀN — XT60 phía pin.** Đầu XT60 phía nối với pin là **đầu cái (female)**. Sau khi hàn xong, bọc gen co cho từng chân riêng rẽ rồi mới bọc chung — hai chân hở cách nhau vài mm với 16,8 V và dòng ngắn mạch hàng trăm ampe là đủ để đốt cháy dây trong một giây.

**Đo ngay sau khi hàn xong, KHÔNG cắm pin:**

```text
Đồng hồ vạn năng -> chế độ continuity

Đo A: chân + của XT60  <->  chân - của XT60
      KẾT QUẢ ĐÚNG: KHÔNG kêu bíp.
      (Có thể có tiếng bíp rất ngắn rồi tắt, hoặc số nhảy rồi dừng ở giá trị lớn —
       đó là tụ đang nạp qua đồng hồ, BÌNH THƯỜNG. Tiếng bíp KÉO DÀI LIÊN TỤC
       mới là chập.)
      NẾU KÊU LIÊN TỤC: KHÔNG CẮM PIN. Tìm cầu thiếc giữa hai pad.

Đo B: chân +  <->  mọi ốc kim loại trên khung
      KẾT QUẢ ĐÚNG: KHÔNG kêu.

Đo C: nhìn bằng mắt qua kính lúp / camera điện thoại zoom
      giữa pad + và pad - có sợi thiếc mảnh nào bắc cầu không.
```

**Kết quả mong đợi:** mối hàn nguồn bóng và gọn, tụ đúng cực, cả ba phép đo đúng.

**Nếu lỗi:**

- *Bíp liên tục ở đo A:* có cầu thiếc. Dùng dây hút thiếc (desoldering wick) hoặc que hút, làm sạch giữa hai pad rồi đo lại. **Tuyệt đối không cắm pin để "thử xem sao".**
- *Thiếc không bám vào pad, vón thành hạt:* pad bị oxy hoá hoặc chưa đủ nóng. Chà nhẹ bằng cục tẩy bút chì, thêm flux, tăng nhiệt/đổi đầu hàn to hơn.
- *Vỏ dây XT60 chảy biến dạng:* nhiệt quá lâu. Vẫn dùng được nếu nhựa chưa hở chân, nhưng kiểm tra kỹ hai chân không chạm nhau.

### 18.7 Đi dây dọc cần và cố định bằng dây rút

Nguyên tắc: **không sợi dây nào được đung đưa tự do, và không sợi nào căng.** Dây đung đưa sẽ cọ xát tới thủng vỏ sau vài chục giờ rung; dây căng sẽ bị giật đứt mối hàn khi khung võng.

1. Luồn bó 3 sợi của mỗi motor chạy **dọc theo mặt dưới của cần**, vào tới tâm khung.
2. Chừa một **vòng dự phòng (service loop)** khoảng 3 cm ở gần tâm — để sau này tháo stack ra mà không phải cắt dây.
3. Cố định bằng dây rút ở **3 điểm mỗi cần**: gần motor, giữa cần, gần tâm. Siết vừa đủ giữ — **nếu vỏ dây bị lõm vào là đã siết quá**.
4. **Cắt đuôi dây rút thật sát và cắt phẳng**, không để đầu nhọn chĩa lên. Đầu dây rút cắt vát là một con dao nhỏ với ngón tay của bạn khi thò tay vào giữa 4 motor.
5. Dây tín hiệu (GPS, receiver, TFmini, ESP32) đi **tách khỏi dây nguồn motor**, tốt nhất là ở phía đối diện của cần hoặc chạy trên tấm trên. Dây nguồn motor mang dòng đóng cắt hàng chục ampe, là nguồn nhiễu mạnh nhất trên drone.

**Kết quả mong đợi:** nhìn từ mọi góc không thấy sợi dây nào lủng lẳng; xoay/lắc khung không có gì cọ vào cánh quạt tưởng tượng.

**Nếu lỗi:** *không đủ chỗ luồn dây ở tâm:* sắp xếp lại theo tầng — dây nguồn motor nằm sát tấm đế, dây tín hiệu nằm trên, không đan chéo.

### 18.8 Bát chống rung và đặt bo bay đúng hướng

Khung S500 **không có lỗ bắt chuẩn 30,5 × 30,5 mm** mà stack F405 V5 cần (khung thiết kế cho bo bay hộp lớn kiểu Pixhawk). Cách xử lý duy nhất đúng là **bát chống rung 30,5 × 30,5** đã mua ở Phase 13: mặt trên bắt stack theo chuẩn 30,5, mặt dưới bắt vào **lỗ có sẵn trên tấm trên**.

> Ghi chú độ chắc chắn: chuẩn lỗ của khung S500 được ghi là 45 × 45 mm trong `docs/linh-kien-s500.html` nhưng **chưa xác minh** bằng bản vẽ chính hãng. Điều chắc chắn và đủ để quyết định là: **không phải 30,5**.

Vì sao **không được bắt cứng stack xuống khung**, ngay cả khi lỗ khớp — số liệu từ tài liệu ArduPilot:

```text
rung < 30 m/s²   chấp nhận được
rung > 30 m/s²   bắt đầu có thể gặp sự cố
rung > 60 m/s²   gần như luôn hỏng phần giữ độ cao và giữ vị trí
```

Triệu chứng khi vượt ngưỡng: bật AltHold thì drone **tự trôi lên hoặc tụt xuống** dù không đụng cần ga; bật Loiter thì trôi ngang. Đúng hai chế độ mà cả đề tài phụ thuộc vào (Phase 20 mục F2, F3).

**Thứ tự cố định mặt dưới của bát vào khung, theo ưu tiên:**

```text
1. Bắt ốc vào lỗ CÓ SẴN trên tấm trên        <- tốt nhất, không khoan gì
2. Băng keo xốp hai mặt dày 1-2 mm (3M VHB)   <- ArduPilot khuyến nghị, và cũng
                                                 chính là cách bản dựng tham chiếu
                                                 S500 của Holybro dùng. Dán KÍN
                                                 cả mặt, KHÔNG dán 4 góc.
3. Dây rút qua lỗ có sẵn                      <- siết vừa đủ; siết quá tay ép chết
                                                 cao su là mất sạch tác dụng
```

> **AN TOÀN:** **Không bắt ốc xuyên qua bát chống rung xuống thẳng khung.** Làm vậy là nối cứng trở lại và 4 quả cao su mất hoàn toàn tác dụng — trong khi bạn vẫn tưởng mình đã chống rung.

**Hướng bo bay:**

1. Đặt stack lên bát, **mũi tên trên mặt FC hướng đúng về phía mũi drone** (phía giữa M1 và M3).
2. Nếu vì đầu cắm mà buộc phải xoay bo, **phải khai báo `AHRS_ORIENTATION`** ở Phase 19 — không được "tự nhớ offset trong đầu".
3. Chồng tầng bằng **ốc nylon + đệm silicone** của hộp Deluxe. Bọc **vỏ silicone** (hộp có 10 cái) vào các mép bo.
4. Kiểm tra: **không để đuôi chân linh kiện tầng dưới chạm mặt đồng tầng trên.** Hai tầng chạm nhau là chập nguồn 4S — cháy cả stack.

**Kết quả mong đợi:** stack nằm chắc trên bát, lắc nhẹ khung thì stack "mềm" theo (đó là cao su đang làm việc), mũi tên hướng đúng, không có kim loại nào chạm nhau giữa hai tầng.

**Nếu lỗi:**

- *Stack lắc quá nhiều, như treo lủng lẳng:* cao su của bát quá mềm so với khối lượng stack — ArduPilot cảnh báo cả hai đầu (quá cứng và quá mềm đều xấu). Thêm đệm hoặc đổi bát. Ghi nhận và kiểm chứng bằng số VIBE ở Phase 20 mục 20.5.
- *Băng keo VHB không dính:* bề mặt còn bụi/dầu. Lau bằng cồn isopropyl, để khô 2 phút, dán rồi **ép mạnh 30 giây**; keo VHB đạt lực bám tối đa sau 24 giờ.

### 18.9 Cáp 10 chân ESC ↔ FC

Bản dựng này dùng ESC 4-in-1 **trong stack**, nên không có dây BEC 5V rời, không cắt dây, không đấu song song gì cả: chỉ có **một sợi cáp 10 chân** giữa hai tầng.

```text
Sợi cáp 10 chân mang:  4 tín hiệu motor + nguồn cho FC + tín hiệu đo dòng + GND
Cắm một chiều duy nhất — giắc có khớp chống ngược, ĐỪNG DÙNG LỰC
```

Hộp Deluxe có 2 sợi (25 mm và 75 mm) — chọn sợi **vừa với khoảng cách giữa hai tầng sau khi đã lắp bát chống rung**. Sợi quá dài phải gập, mà gập thì dễ kẹt.

Checklist chống ngắn mạch giữa hai tầng:

```text
[ ] Đã bọc vỏ silicone vào mép FC và mép ESC
[ ] Dùng ốc nylon + đệm silicone để chồng tầng (không dùng ốc kim loại xuyên tầng)
[ ] Không có đuôi chân linh kiện tầng dưới chạm mặt đồng tầng trên
[ ] Sợi cáp 10 chân gập gọn, KHÔNG bị kẹt giữa hai bo khi siết ốc
```

> **AN TOÀN:** Kiểm tra lần cuối bằng mắt **sau khi siết ốc** — sợi cáp bị kẹt và bị ốc ép thủng vỏ là đường chập trực tiếp từ nguồn 4S vào chân tín hiệu.

**Kết quả mong đợi:** cáp cắm chắc hai đầu, không kẹt, hai tầng cách nhau đều.

**Nếu lỗi:** *giắc không vào:* đang cắm ngược. Xoay 180°, tìm khớp chống ngược. Ép mạnh là gãy chân giắc trên bo — hỏng vĩnh viễn.

### 18.10 Receiver iA6B và hai anten

iA6B dùng iBUS, cắm vào **R6 → SERIAL6** (`SERIAL6_PROTOCOL,23`, `RC_PROTOCOLS,4`), đã cấu hình và bind ở Phase 15. Ở đây chỉ là việc cố định.

1. Dán receiver bằng băng keo xốp hai mặt lên **tấm trên**, ở vị trí **càng xa stack và dây nguồn motor càng tốt** — thường là phía đuôi, lệch sang một bên.
2. Hai sợi anten: **đặt vuông góc 90° với nhau** (một sợi dọc theo thân, một sợi ngang) và **duỗi thẳng phần đầu nhạy** (đoạn ~30 mm cuối, chỗ lõi trắng).
3. Đoạn đầu nhạy **không được nằm sát kim loại, sợi carbon, dây nguồn, hoặc cuộn tròn lại**. Cách phổ biến và rẻ: cắt hai đoạn ống hút nhựa, luồn anten vào, dây rút ống hút vào chân đáp hoặc cần, chĩa chéo xuống dưới.
4. Kiểm tra: đứng cách drone 2 m, bật tay FS-i6X, đèn receiver phải sáng ổn định. Việc test RSSI/failsafe thật thuộc Phase 19 mục 19.8.

> **AN TOÀN:** Anten nằm sát dây nguồn motor làm **giảm tầm điều khiển** một cách âm thầm — trên bàn vẫn tốt, ra sân mới rớt, và lúc đó drone đang ở trên không. Đây là lý do có bước 90° và bước tách khỏi dây nguồn, không phải hình thức.

**Kết quả mong đợi:** receiver dán chắc, hai anten vuông góc, phần đầu nhạy duỗi thẳng và cách dây nguồn ≥ 5 cm.

### 18.11 GPS M10 trên cột và hướng la bàn

GPS Holybro M10 mang cả **la bàn IST8310 trên I2C** — và bo F405 V5 **không có la bàn tích hợp**, nên đây là la bàn duy nhất của drone. La bàn rất nhạy với từ trường của dây nguồn motor.

1. Bắt **cột nâng GPS** ở phía **đuôi drone**, trên tấm trên, càng xa stack và càng xa 4 dây nguồn motor càng tốt.
2. Dựng cột lên hết cỡ (thường 10–15 cm). Cột càng cao thì nhiễu từ càng nhỏ — nhưng cột quá cao và mềm sẽ rung, làm hỏng số liệu; nếu cột lắc khi búng tay thì gia cố bằng một dây rút chéo.
3. **Mũi tên trên vỏ GPS hướng về phía trước**, cùng hướng với mũi tên FC. Nếu hai mũi tên không cùng hướng, phải đặt `COMPASS_ORIENT` ở Phase 19 mục 19.4.
4. Dây GPS (`SERIAL4`) và dây I2C đi **tách khỏi dây nguồn**, bám theo mép tấm trên.

> **AN TOÀN:** Không đặt GPS/la bàn ngay trên hoặc ngay cạnh dây nguồn motor. Triệu chứng nếu sai: Loiter quay vòng tròn mở rộng dần ("toilet bowl") — chẩn đoán ở Phase 20 mục 20.7. Đó là kiểu lỗi làm drone bay mất kiểm soát ra xa người.

**Kết quả mong đợi:** GPS trên cột ở đuôi, mũi tên hướng trước, cột không lắc, dây đi tách khỏi nguồn.

### 18.12 Gắn TFmini Plus hướng thẳng về phía trước

TFmini Plus trong dự án này **nhìn thẳng về phía trước** (không phải nhìn xuống), để phanh/né vật cản phía trước ở Loiter và AltHold. Cắm vào **SERIAL3** (`SERIAL3_PROTOCOL,9`, `RNGFND1_TYPE,20`, `PRX1_TYPE,4`), đã test ở Phase 17.

1. Làm/mua một bát nhỏ bắt vào **mép trước của tấm trên** hoặc vào thanh ngang phía mũi.
2. **Chiều cao:** đặt sao cho tia nhìn **không quét vào chân đáp** và **không quét xuống mặt đất khi drone chúi mũi** ở góc nghiêng bay thường (~15°). Thực tế: gắn ở **mép trên của tấm trên**, chĩa ngang, hơi ngẩng lên 2–3° là an toàn.
3. **Kiểm tra tầm nhìn bằng mắt:** ngồi xuống ngang tầm cảm biến, nhìn dọc theo hướng ống kính — **không được thấy bất kỳ phần nào của drone** (chân đáp, cánh, dây, GPS). Chùm tia của TFmini Plus rất hẹp (~3,6°) nên chỉ cần lệch nhẹ là quét trúng chân đáp và báo "có vật cản ở 0,3 m" suốt chuyến bay.
4. **Không để nắng chiếu thẳng vào ống kính.** Cảm biến hồng ngoại bị nắng gắt chiếu trực diện sẽ trả số rác. Nếu bay giữa trưa, làm một mái che nhỏ phía trên cảm biến (không che tia).
5. Dây GH1.25-4P dài 30 cm — datasheet khuyến cáo **không nối dài quá 1 m**. Đấu theo bảng màu (từ chú thích đầu `params/obstacle-avoidance-tfminiplus-serial3.param`):

```text
Đỏ    PIN-1  +5V   -> pad 5V của stack (KHÔNG dùng chung UBEC với ESP32)
Trắng PIN-2  RXD   -> để trống (driver ArduPilot không gửi lệnh ra cảm biến)
Xanh  PIN-3  TXD   -> chân RX của SERIAL3 (UART3 = PC11)
Đen   PIN-4  GND   -> GND chung
```

> **AN TOÀN — nguồn 5V.** TFmini Plus lấy 5V từ **BEC của stack** (cùng với GPS ~40 mA và iA6B ~50 mA; TFmini 110 mA, đỉnh 140 mA — tổng ~200 mA trên 2,5 A, thừa rất nhiều). **Không** cắm chung với UBEC của ESP32: datasheet ghi rõ TFmini Plus **không có bảo vệ quá áp / ngược cực** và chỉ chịu dao động ±0,5 V, trong khi ESP32 bật Wi-Fi gây sụt áp đột ngột.

**Kết quả mong đợi:** cảm biến chắc, nhìn thẳng trước, không thấy phần nào của drone trong tầm nhìn, dây đúng màu, nguồn lấy từ BEC stack.

**Nếu lỗi:** *không chắc tia có quét trúng chân đáp không:* để drone lên bàn, bật nguồn ở Phase 19 và đọc `rangefinder1` trong Mission Planner → `Flight Data` → tab `Status`. Nếu số đứng yên ở một giá trị nhỏ cố định dù không có vật cản trước mặt, tia đang quét trúng chính drone.

### 18.13 ESP32 bridge, board camera, UBEC 5V 3A

Hai con ESP32 dùng **UBEC 5V 3A riêng lấy thẳng từ pin**, không ăn ké BEC 5V của stack — vì camera kéo sụt áp sẽ làm FC reset giữa lúc bay.

```text
LiPo 4S ──┬── ESC OX32 ──→ motor + FC + GPS + iA6B + TFmini
          │
          └── UBEC 5V 3A ──→ ESP32 bridge + board camera
```

1. **UBEC:** dán vào tấm trên bằng băng keo xốp, đầu vào hàn/cắm song song với đường nguồn pin (sau XT60). Bọc gen co đầu vào.
2. **ESP32 DevKit (bridge, SERIAL2):** dán ở **đuôi**, anten PCB chĩa ra ngoài khung, không bị tấm sợi thuỷ tinh hay pin che. Dây UART đi tách khỏi dây nguồn motor.
3. **Board camera:** quyết định chọn ESP32-S3 hay ESP32-CAM **vẫn đang để mở** (`plans/QUYET-DINH-CHUA-CHOT.md`). Làm bát gắn **dùng được cho cả hai**: một tấm đế phẳng có 4 lỗ khe dài (slot) thay vì lỗ tròn, để trượt được theo cả hai khoảng cách lỗ; cộng 4 quả cao su chống rung nhỏ.
4. **Vị trí camera:** gắn ở **mép trước, gần đường tâm dọc của drone, chĩa xuống chếch về trước**. Không đưa ra xa mũi — mỗi cm ra trước là một lần phải dịch pin về sau để bù CG (mục 18.14).
5. **Chống brownout cho camera:** hàn tụ **470–1000 µF** sát chân nguồn của board camera. ESP32-CAM bật Wi-Fi gây burst dòng làm chính nó reset.
6. Tất cả dây tín hiệu ESP32 đi **trên tấm trên**, tách khỏi dây nguồn motor.

> **AN TOÀN:** Nếu vì lý do nào đó bạn chỉ có một nguồn 5V, **ưu tiên tuyệt đối cho stack/GPS/receiver/TFmini** và **không gắn camera lên drone chuyến đó**. Camera chết giữa chuyến là mất dữ liệu; FC reset giữa chuyến là rơi. `SAFETY.md` mục 9 nói rõ: mất camera thì telemetry và control vẫn phải chạy, UAV không đổi mode.

**Kết quả mong đợi:** UBEC + 2 board cố định chắc, anten không bị che, tụ chống brownout đã hàn, bát camera lắp được cho cả hai loại board.

### 18.14 Dây đai pin, đặt pin, và cân trọng tâm (CG)

**Đặt pin:**

1. Dán **mặt nhám của velcro** lên tấm đế (hoặc tấm dưới của khay pin), mặt kia lên pin. Velcro chống trượt, **dây đai mới là thứ giữ pin**.
2. Luồn **dây đai pin** qua khe có sẵn của khung, vòng qua pin, siết chặt. Kiểm tra: xách drone lên bằng chính viên pin — pin không được xê dịch.
3. Đầu XT60 quay về phía **dễ với tay nhất**, và **không** nằm dưới cánh quạt.

> **AN TOÀN — pin tuột giữa không trung.** Pin 423 g rơi từ 10 m đủ gây thương tích nặng, và drone mất pin là mất điện ngay lập tức. Velcro một mình **không đủ** — rung + nhiệt làm keo velcro bong dần. Luôn có dây đai, và kiểm tra dây đai trong walk-around trước mỗi chuyến (Phase 19 mục 19.14).

**Cân trọng tâm:**

Trọng tâm phải nằm **đúng tâm hình học của khung** (giao điểm hai đường chéo giữa 4 motor), sai lệch càng nhỏ càng tốt. CG lệch làm ArduPilot phải giữ một góc nghiêng thường trực để bù, ăn mất biên điều khiển và làm Loiter trôi.

Cách đo, sau khi **đã gắn đủ mọi thứ kể cả pin**, chưa gắn cánh:

1. Đặt **hai ngón trỏ** của hai bàn tay xuống dưới, vào đúng hai điểm đối xứng qua tâm (ví dụ hai cần chéo nhau, cách tâm bằng nhau).
2. Nhấc drone lên khỏi bàn 2–3 cm.
3. Quan sát: drone phải **nằm gần như ngang**. Không được chúi mạnh về trước, không ngửa mạnh về sau, không nghiêng hẳn sang một bên.
4. Nếu lệch: **dịch pin** theo hướng ngược lại (pin là vật nặng nhất có thể dịch, 423 g trên tổng ~1,8 kg). Dịch từng 5 mm, đo lại.
5. Chỉ khi dịch hết pin mà vẫn lệch thì mới dịch các vật nhỏ (ESP32, UBEC).
6. Đánh dấu vị trí pin bằng bút dạ lên velcro — để lần sau đặt lại đúng chỗ.

**Kết quả mong đợi:** treo trên hai đầu ngón tay, drone nằm ngang trong khoảng ±5°; vị trí pin đã đánh dấu.

**Nếu lỗi:**

- *Chúi mũi nhiều dù pin đã lùi hết cỡ:* camera/TFmini đưa ra trước quá xa. Rút camera về gần tâm hơn (mục 18.13 bước 4).
- *Lệch sang một bên:* thường do dây/UBEC dồn về một phía. Chia lại.

### 18.15 Cân khối lượng thật và đối chiếu ngân sách

Cân bằng cân điện tử nhà bếp (độ chia 1 g), ghi vào `docs/do-dac/18-can-khoi-luong.md`:

| Hạng mục cân | Ước lượng tài liệu | Cân thật |
|---|---|---|
| Khung S500 V2 đã lắp + chân đáp | 782 g | |
| Drone hoàn chỉnh **không pin, không cánh** | — | |
| Drone hoàn chỉnh **không pin, có cánh** (khối lượng khô) | 1291 g | |
| Pin Ovonic 4S 5300 mAh | 423 g | |
| **AUW chưa có camera** | ≈ 1714 g | |
| **AUW đầy đủ có camera** | ≈ 1824 g | |

Con số trần lực đẩy để đối chiếu (từ `docs/bao-cao-tong-quan-du-an.md` mục 3.2, **chưa xác minh bằng đo thật**):

```text
Tran cua MOTOR : 1332 g moi chiec  ->  4 x 1332 = 5328 g
Tran cua CANH  : 1200 g moi chiec  ->  4 x 1200 = 4800 g   <- lay con so THAP hon
```

Tính tỉ số: `4800 / AUW_cân_thật`. Tài liệu ước tính **2,80 : 1** (chưa camera) và **2,63 : 1** (đầy đủ).

> **AN TOÀN — ngưỡng 2:1.** Ngưỡng tối thiểu cho một nền tảng ổn định là **2 : 1**. Nếu AUW cân thật vượt **2400 g**, tỉ số tụt xuống dưới 2:1 và **phải xử lý trước khi cất cánh**: giảm payload, hoặc đổi sang cánh 1047/1147. Không bay với tỉ số dưới 2:1 vì "chỉ thêm mấy chục gram" — drone sẽ không đủ biên để cứu khi có gió giật.
>
> Tỉ số trên vẫn chỉ là tính toán từ tài liệu. **Phép đo thật bắt buộc** (bắt cố định một cần xuống bàn với motor hướng **xuống dưới**, đặt lên cân điện tử, đeo kính bảo hộ, gắn cánh, chạy Motor Test 25/50/75/100 % và ghi số gam) được lên lịch ở **Phase 19 mục 19.13**, không làm ở phase này vì phase này chưa cấp điện và chưa gắn cánh.

**Kết quả mong đợi:** bảng khối lượng đã điền đủ; tỉ số tính ra ≥ 2 : 1 theo trần cánh.

### 18.16 Checklist ảnh trước khi đóng nắp

Chụp bằng điện thoại, đủ sáng, lưu vào `docs/so-tay/anh/18/`. Bộ ảnh này là thứ cứu bạn khi ba tuần nữa phải tháo ra sửa và không nhớ dây nào đi đâu, và là bằng chứng cho báo cáo môn học.

```text
[ ] 01-khung-tren.jpg      toàn cảnh từ trên xuống, thấy rõ nhãn M1..M4
[ ] 02-khung-duoi.jpg      toàn cảnh từ dưới lên, thấy đi dây dọc cần
[ ] 03-pad-nguon.jpg       cận cảnh mối hàn XT60 + pad BAT+/BAT-, ĐỌC ĐƯỢC ký hiệu cực
[ ] 04-tu-dien.jpg         cận cảnh tụ 1000uF, thấy rõ vạch dấu cực âm
[ ] 05-moi-han-motor.jpg   cận cảnh 3 mối hàn của một motor trước khi bọc gen to
[ ] 06-bat-chong-rung.jpg  stack trên bát, thấy rõ mũi tên FC hướng trước
[ ] 07-cap-10-chan.jpg     đường đi của cáp giữa hai tầng
[ ] 08-gps-mast.jpg        cột GPS, thấy mũi tên GPS và khoảng cách tới dây nguồn
[ ] 09-tfmini.jpg          chụp NGANG TẦM cảm biến theo hướng nhìn của nó
[ ] 10-anten-rx.jpg        hai anten receiver, thấy rõ góc 90 độ
[ ] 11-esp32-ubec.jpg      vị trí ESP32 bridge, camera, UBEC
[ ] 12-can-CG.jpg          ảnh treo drone trên hai đầu ngón tay
[ ] 13-can-nang.jpg        ảnh màn hình cân điện tử với AUW
```

## Cổng pass

- [ ] Khung lắp xong; đặt trên mặt bàn phẳng, 4 đầu cần cùng mặt phẳng, khung không bập bênh, không cần nào cong hay rơ.
- [ ] **Không có lỗ khoan mới nào trên tấm đế S500.**
- [ ] 4 motor bắt chắc, quay trơn bằng tay, cần đã dán nhãn `M1` `M2` `M3` `M4` đúng quy ước Quad X của ArduPilot (M1 trước-phải CCW, M2 sau-trái CCW, M3 trước-trái CW, M4 sau-phải CW).
- [ ] 4 motor đã phân loại theo chiều ren và đặt đúng vị trí (2 ren cho vị trí CCW ở M1/M2, 2 ren cho vị trí CW ở M3/M4); cánh vặn vào bằng tay được, không phải dùng lực.
- [ ] 12 mối hàn nối dài dây motor đã bọc gen; với **cả 4 motor**: thông mạch từng pha OK, 3 điện trở giữa các pha bằng nhau, **không pha nào chạm vỏ motor hay chạm ốc khung**.
- [ ] Đo continuity `BAT+` ↔ `BAT−`: **không kêu bíp liên tục**. Đo `BAT+` ↔ ốc khung: **không kêu**.
- [ ] Tụ 1000 µF đã hàn sát pad `BAT+`/`BAT−` của ESC, **đúng cực** (đã đối chiếu vạch dấu trên thân tụ, có ảnh `04-tu-dien.jpg`).
- [ ] Stack nằm trên bát chống rung 30,5×30,5; **không có ốc nào xuyên qua bát xuống thẳng khung**; mũi tên FC hướng về mũi drone (hoặc đã ghi lại góc xoay để đặt `AHRS_ORIENTATION` ở Phase 19).
- [ ] Cáp 10 chân cắm chắc hai đầu, không kẹt giữa hai tầng; đã bọc vỏ silicone; không có kim loại nào chạm giữa hai tầng.
- [ ] Hai anten iA6B vuông góc 90°, phần đầu nhạy duỗi thẳng, cách dây nguồn motor ≥ 5 cm.
- [ ] GPS M10 trên cột ở phía đuôi, mũi tên GPS cùng hướng mũi tên FC (hoặc đã ghi lại độ lệch cho `COMPASS_ORIENT`).
- [ ] TFmini Plus chĩa thẳng trước; nhìn dọc theo hướng ống kính **không thấy bất kỳ phần nào của drone**; nguồn lấy từ BEC của stack (không dùng chung UBEC với ESP32).
- [ ] ESP32 bridge + board camera + UBEC 5V 3A cố định chắc; tụ 470–1000 µF đã hàn sát chân nguồn board camera; bát camera lắp được cho cả ESP32-S3 lẫn ESP32-CAM.
- [ ] Pin gắn bằng velcro **và** dây đai; xách drone lên bằng pin thì pin không xê dịch; vị trí pin đã đánh dấu bút dạ.
- [ ] Treo drone (đã có pin, chưa có cánh) trên hai đầu ngón tay tại hai điểm đối xứng qua tâm → nằm ngang trong ±5°.
- [ ] `docs/do-dac/18-can-khoi-luong.md` đã điền đủ số cân thật; tỉ số `4800 g / AUW` ≥ 2 : 1.
- [ ] Đủ 13 ảnh trong `docs/so-tay/anh/18/`.
- [ ] `docs/so-tay/18-lap-rap-khung.md` đã viết xong.
- [ ] **Cánh T1045 vẫn còn nguyên trong hộp, chưa từng gắn lên drone.**

## Rủi ro

| Rủi ro | Khả năng (1-5) | Ảnh hưởng (1-5) | Điểm | Xử lý |
|---|---|---|---|---|
| Mối hàn nguội trên dây motor → desync giữa không trung → rơi | 4 | 5 | **20** | Kỹ thuật hàn ở 18.5 (mạ trước, nối chồng, giữ yên khi nguội); kiểm tra bóng/xỉn bằng mắt; đo 3 điện trở pha phải bằng nhau; test desync bằng Motor Test ở Phase 19 mục 19.6 trước khi ra sân |
| Đấu ngược cực nguồn → cháy toàn bộ stack ngay lần cắm pin đầu | 2 | 5 | **10** | Chụp ảnh ký hiệu `+`/`−` trước khi phủ thiếc; hàn dây đen trước; đo continuity ba phép ở 18.6; dùng smoke stopper ở Phase 19 mục 19.2 |
| Khoan vào tấm đế trúng đường đồng chìm → chập chờn chỉ hiện khi nóng | 2 | 5 | **10** | Cảnh báo ở 18.2; bản dựng này không cần khoan lỗ nào; cổng pass có dòng "không có lỗ khoan mới nào" |
| Bắt cứng stack vào khung / ốc xuyên bát chống rung → VIBE > 30 m/s² → AltHold và Loiter hỏng | 3 | 4 | **12** | Quy tắc ở 18.8; ưu tiên bắt vào lỗ có sẵn hoặc băng keo VHB dán kín mặt; kiểm chứng bằng số VIBE trong log ở Phase 20 mục 20.5 |
| TFmini quét trúng chân đáp hoặc chính drone → báo vật cản giả suốt chuyến | 4 | 3 | 12 | Kiểm tra bằng mắt ngang tầm cảm biến ở 18.12; xác nhận bằng `rangefinder1` trên Mission Planner ở Phase 19 |
| Tụ 1000 µF lắp ngược → nổ tụ khi cắm pin | 2 | 4 | 8 | Đối chiếu chân dài/ngắn **và** vạch dấu trên thân; chụp ảnh `04-tu-dien.jpg`; đeo kính bảo hộ ở lần cắm pin đầu |
| Motor đặt sai chiều ren → cánh tự nới ra khi quay → văng cánh | 2 | 5 | **10** | Phân loại ren bằng tay ở 18.3 trước khi bắt vít; kiểm chứng lại khi gắn cánh ở Phase 19 mục 19.13 (vặn tay theo chiều quay phải thấy siết chặt) |
| Anten receiver sát dây nguồn → giảm tầm, rớt RC khi ra sân | 3 | 4 | 12 | Quy tắc 90° + cách nguồn ≥ 5 cm ở 18.10; test tầm thật ở Phase 19 mục 19.8 |
| Pin tuột giữa chuyến bay | 2 | 5 | **10** | Bắt buộc có dây đai ngoài velcro; test xách drone bằng pin ở 18.14; đưa vào walk-around Phase 19 |
| Cân thật nặng hơn ước lượng → tỉ số lực đẩy < 2:1 | 2 | 4 | 8 | Cân và tính tỉ số ở 18.15; nếu AUW > 2400 g thì giảm payload hoặc đổi cánh 1047/1147 trước khi bay |
| Mỏ hàn 60 W không đủ nhiệt cho pad nguồn → cố hàn lâu làm chảy vỏ dây | 3 | 3 | 9 | Quy tắc "10 giây không chảy thì dừng" ở 18.6; thêm flux; mượn mỏ hàn 80–100 W |
| Cáp 10 chân bị kẹt và ép thủng khi siết ốc → chập nguồn 4S vào chân tín hiệu | 2 | 5 | **10** | Checklist 4 dòng ở 18.9; kiểm tra bằng mắt **sau khi** siết ốc |
| Làm mất ốc nhỏ của bộ S500 (không mua lẻ được) | 3 | 2 | 6 | 5 hộp có nhãn ở 18.1; trải giấy trắng trên bàn |

## Timeline

| Việc | Giờ | Ghi chú |
|---|---|---|
| 18.1 Dọn bàn, dán nhãn, quy tắc | 0,5 | |
| 18.2 Lắp khung (cần, chân đáp, tấm trên) | 1,5 | |
| 18.3 Xác định M1–M4 + phân loại chiều ren | 1,0 | Làm chậm — đây là bước dễ sai nhất |
| 18.4 Bắt motor lên cần | 1,0 | |
| 18.5 Nối dài dây motor, 12 mối hàn | **3,5** | Việc dài nhất; đo continuity sau mỗi motor |
| 18.6 Hàn XT60 + dây ESC + tụ, đo 3 phép | 1,5 | Có thể rút còn 0,5 nếu stack đã có sẵn dây XT60 đủ dài |
| 18.7 Đi dây, dây rút | 1,0 | |
| 18.8 Bát chống rung + đặt stack | 1,0 | |
| 18.9 Cáp 10 chân + chống ngắn mạch hai tầng | 0,5 | |
| 18.10 Receiver + anten 90° | 0,5 | |
| 18.11 GPS mast + hướng la bàn | 0,5 | |
| 18.12 TFmini hướng trước | 0,5 | |
| 18.13 ESP32 + camera + UBEC | 1,0 | Bát camera làm dùng chung cho cả hai loại board |
| 18.14 Đai pin + cân CG | 0,5 | |
| 18.15 Cân khối lượng + đối chiếu ngân sách | 0,5 | |
| 18.16 Chụp 13 ảnh checklist | 0,5 | |
| Viết `docs/so-tay/18-lap-rap-khung.md` | 1,0 | |
| **Tổng** | **~16,0** | Nên chia làm 2–3 buổi; không hàn khi đã mệt |

Đường găng: 18.2 → 18.4 → 18.5 → 18.7 → 18.8. Ba việc 18.10–18.12 (receiver, GPS, TFmini) độc lập với nhau, làm thứ tự nào cũng được. 18.6 có thể làm song song trong lúc chờ keo VHB của 18.8 bám.

## Ghi chú cho sổ tay

Những khái niệm phase này phải giải thích cho người chưa biết gì (agent viết `docs/so-tay/18-lap-rap-khung.md` bám theo danh sách này):

- **PDB (power distribution board) là gì**, và vì sao tấm đế S500 vừa là kết cấu cơ khí vừa là mạch điện — nên không được khoan.
- **Mối hàn nguội trông như thế nào** — ảnh so sánh bóng/mượt với xỉn/sần, và vì sao nó nguy hiểm hơn mối hàn đứt hẳn (đứt hẳn thì biết ngay, nguội thì hỏng lúc đang bay).
- **Vì sao phải nung đồng chứ không nung thiếc** — nguyên lý "nhiệt đi từ mỏ hàn qua kim loại, thiếc chỉ là chất lấp đầy".
- **AWG là gì**, vì sao số càng nhỏ thì dây càng to, và cách ước tính dòng cho phép.
- **Continuity mode của đồng hồ vạn năng** — đọc số thế nào, `OL`/`1` nghĩa là gì, và vì sao đo pha-với-pha trên motor brushless *có* kêu bíp mà vẫn bình thường.
- **Vì sao động cơ brushless đổi chiều bằng cách đảo 2 trong 3 dây** — giải thích ngắn về từ trường quay 3 pha.
- **Quy ước đánh số motor Quad X của ArduPilot** và vì sao nó không giống quy ước của các firmware khác (Betaflight đánh số khác) — kèm hình.
- **Ren tự siết (self-tightening) của AIR GEAR** — vì sao có ren trái và ren phải, và vì sao không được lắp lẫn.
- **Tụ điện có cực** — chân dài/ngắn, vạch dấu, hậu quả khi lắp ngược, và tụ này để làm gì (hấp thụ xung điện áp khi ESC đóng cắt).
- **Rung (vibration) ảnh hưởng tới bay như thế nào** — cảm biến gia tốc, ngưỡng 30/60 m/s², vì sao nó phá AltHold và Loiter trước tiên.
- **Trọng tâm (CG)** — vì sao lệch CG làm drone phải nghiêng thường trực và ăn mất biên điều khiển.
- **Tỉ số lực đẩy / khối lượng (T/W)** — ý nghĩa ngưỡng 2:1, và vì sao phải lấy trần của cánh chứ không lấy trần của motor.
- **La bàn và nhiễu từ** — vì sao dây nguồn motor làm hỏng số liệu la bàn, vì sao phải đưa GPS lên cột và ra xa.
- **Vì sao anten phải vuông góc 90°** — phân cực sóng, và vì sao mất tầm là kiểu lỗi âm thầm.

---

**Prior-art:** phase này rút vật liệu thô từ nháp cũ `README.md` GIAI ĐOẠN 26 (lắp khung S500, cảnh báo cấm khoan tấm đế có đồng đúc chìm), 27 (lắp và đánh nhãn motor), 28 (hệ thống nguồn, tụ 1000 µF, tách UBEC cho ESP32), 29 (cáp 10 chân FC↔ESC, chống ngắn mạch hai tầng), 30 (đo đồng hồ trước khi cấp điện), 31 (lắp FC, bát chống rung 30,5×30,5, mũi tên hướng trước, ngưỡng rung 30/60 m/s²), 66 (camera mount), 67 (center of gravity), 68 (kiểm tra payload). Số liệu khối lượng và lực đẩy lấy từ `docs/bao-cao-tong-quan-du-an.md` mục 3.2. Bảng màu dây và phân bổ nguồn 5V lấy từ chú thích đầu `params/obstacle-avoidance-tfminiplus-serial3.param`. Nháp cũ được dùng làm **vật liệu thô, không phải cấu trúc**: thứ tự việc, các bước đo kiểm, và toàn bộ phần cân CG/khối lượng ở đây là mới.
