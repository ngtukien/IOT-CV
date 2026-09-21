# P1 — Flight & Hardware Lead · Safety Officer

> Đọc trước: [SAFETY.md](../../SAFETY.md) **toàn bộ**; [README.md](../../README.md) GĐ 24–54, 63–68, 83–84, 87–88, 90–91.
> Kế hoạch chung: [team-plan.md](../team-plan.md)

**Câu bạn phải trả lời được bất cứ lúc nào:**
*"Máy bay này an toàn để bay chưa, và vì sao tôi biết?"*

---

## Bạn sở hữu

| Nhóm | Chi tiết |
|---|---|
| **ArduPilot trên phần cứng thật** | Flash, frame type, params, calibration, failsafe, geofence |
| **Drone vật lý** | Lắp, đấu dây, test linh kiện, motor test, ESC cal, cánh |
| **Mọi buổi bay** | PIC (Pilot in Command) — cầm RC từ đầu đến cuối |
| **Tài liệu phần cứng** | `docs/wiring.md`, `docs/parameters.md`, `docs/test-log.md` |
| **Parameter versioning** | `params/*.param` sau mỗi mốc (GĐ 88) |
| **BOM & mua hàng** | Lập danh sách linh kiện tuần 1, chốt đơn mua tuần 3 |

**Bạn KHÔNG sở hữu:** code backend, web, firmware ESP32, model YOLO.

**Vai trò Checker trong buổi lắp:** P2 cầm multimeter + đọc checklist, nhưng **P1 là người quyết định cuối cùng** trước khi cắm LiPo.

---

## Quyền đặc biệt

- **Quyền hủy tuyệt đối** mọi buổi bay — hô "abort" là tất cả dừng, không tranh luận tại sân.
- **Approve bắt buộc** mọi PR có nhãn `safety` (mode, failsafe, dead-man, geofence, motor output).
- **Chốt đơn mua** phần cứng — không ai tự mua Batch C/D khi chưa có xác nhận của P1.

---

## Lịch tuần theo tuần

### Phase 0 — Tuần 1: BOM & học 5 mode

**Mục tiêu:** Lập BOM, tìm sân, chạy được SITL theo guide của P2 để học 5 mode.

> SITL là của P2 — P2 cài, viết guide, viết `scripts/run_sitl.sh`. P1 theo guide đó mà chạy.

| Việc | File/output | CỔNG PASS |
|---|---|---|
| Chạy SITL theo `docs/dev-env.md` của P2 | — | MAVProxy Console + Map + ArduCopter running |
| Lập BOM có giá thực tế | `docs/bom.md` | tổng ≤ 6 triệu, buffer 10% |
| Chạy thử 5 mode trong MAVProxy | ghi vào `docs/test-log.md` | GĐ 4: arm → takeoff → GUIDED → LOITER → RTL |
| Tìm sân bay (địa điểm test ngoài trời) | ghi địa chỉ vào `docs/test-log.md` | ≥ 1 sân xác định từ tuần 2 |

---

### Phase 1 — Tuần 2–3: SITL oracle & chuẩn bị mua

**Mục tiêu:** Làm "oracle" cho P2/P3 — dùng Mission Planner kiểm tra sản phẩm của họ.

| Việc | Chi tiết |
|---|---|
| Học sâu 5 mode | STABILIZE / LOITER / GUIDED / AUTO / RTL — biết param nào ảnh hưởng gì |
| Mission Planner làm oracle | Mỗi lần P2 upload mission thử nghiệm: download lại bằng MP và xác nhận đúng |
| Review `docs/architecture.md` của P2 | Phần safety, mode transition, failsafe phải ký approve |
| Chuẩn bị đơn hàng Batch C+D | Danh sách linh kiện đầy đủ, địa chỉ shop, ước thời gian giao |

---

### Phase 2 — Tuần 4–5: Nhận hàng & lắp phần cứng

**Mục tiêu:** Drone đã lắp hoàn chỉnh, chưa gắn cánh.

#### 4 buổi trọng điểm cần đủ đội (xem vai trong team-plan.md mục 7.1):

| Buổi | Nội dung | GĐ README |
|---|---|---|
| **Buổi 1** | Test từng linh kiện + đấu nguồn (PDB, ESC, UBEC) | 25–30 |
| **Buổi 2** | Lắp FC + flash ArduPilot + frame type | 31–33 |
| **Buổi 3** | Wiring receiver, GPS, ESC signal | 34–37, 40 |
| **Buổi 4** | Motor test, motor direction, ESC cal | 41–44 |

**Quy tắc mỗi buổi:**
```text
P1 (chủ trì) → quyết định, đo, chịu trách nhiệm
P3 (hands)   → hàn, đấu dây, tay thứ hai
P2 (checker) → đọc checklist to lên, cầm multimeter xác nhận
P4 (logger)  → chụp ảnh từng bước, ghi docs/wiring.md ngay tại bàn
```

**Checklist trước khi cắm LiPo lần đầu (P2 đọc to, P1 xác nhận):**
- [ ] Multimeter continuity BAT+ ↔ GND: **không beep**
- [ ] Tất cả ESC dây signal đúng motor
- [ ] Không có short nhìn thấy được
- [ ] Smoke stopper đã sẵn sàng
- [ ] Props đã tháo

**Commit sau mỗi buổi:**
```bash
git commit -m "docs: wiring session 1 — power + frame"
```

> **Cổng G2 (phần cứng):** Motor test pass, motor direction đúng, ESC cal xong, pre-arm check không lỗi.

---

### Phase 3 — Tuần 6–7: Calibration & first flight

**Mục tiêu:** Drone thật hover ổn định, Loiter không toilet-bowl, RTL về home.

| Việc | GĐ | Điều kiện đi tiếp |
|---|---|---|
| Radio calibration | 35 | Stick center ≈ center, full range đúng |
| Map RC switch | 36 | SWC: Stabilize/Loiter/Auto; SWD: RTL |
| Accelerometer calibration | 38 | Không lỗi MP |
| Compass calibration | 39 | Ra ngoài, xa kim loại |
| Pre-arm check đầy đủ | 45 | Tất cả xanh |
| Failsafe RC (không prop) | 46 | Tắt TX → MP thấy Radio failsafe |
| **Gắn cánh** | 49 | Chỉ khi 8 bước trên đều pass |
| **First flight — Stabilize** | 50 | Hover 0.5–1m, không gió lớn |
| Đọc log sau first hop | 51 | Vibration, GPS, EKF, motor outputs |
| AltHold | 52 | Không drift nhiều |
| **Loiter** | 53 | Giữ vị trí, không toilet-bowl |
| **RTL** | 54 | Bay về home, land đúng |

**⚠️ Không bao giờ đi Auto trước khi Loiter pass.**

Lưu param sau mỗi bước:
```text
params/02-radio.param
params/03-gps.param
params/04-first-flight.param
params/05-loiter-good.param
```

> **Cổng G3 (phần cứng):** Loiter không toilet-bowl, RTL về home thành công.

---

### Phase 4 — Tuần 8–9: Auto Mission Planner & wiring bridge

| Việc | GĐ | Ghi chú |
|---|---|---|
| Auto mission bằng Mission Planner | 55 | 4 waypoint, Takeoff → WP → RTL |
| Wiring ESP32 bridge | 56 | P2 phụ firmware |
| Failsafe GCS (bench test) | 47 | Ngắt MAVLink → RTL |
| Failsafe battery | 48 | Xác nhận voltage đọc đúng bằng multimeter trước |
| Geofence — cài sẵn | 83 | MAX_ALT=10m, MAX_RADIUS=50m |

---

### Phase 5 — Tuần 10–11: Bay bằng web + camera

**Mục tiêu:** PIC trong mọi buổi bay tích hợp.

| Việc | GĐ | Vai P1 |
|---|---|---|
| Auto web flight | 63 | PIC, cầm RC sẵn sàng override |
| Web manual WASD | 64 | PIC, tốc độ 0.5 m/s trước |
| RC override test | 65 | Bắt buộc: gạt Loiter khi web đang WASD → web mất quyền |
| Camera mount + CG | 66–68 | Phê duyệt vị trí đặt camera (CG, payload) |
| Hover camera test | 71 | PIC |
| Dataset bay thật | 72 | PIC cho P4 thu dữ liệu |

---

### Phase 6 — Tuần 12: Test matrix & kết thúc

| Việc | GĐ | Output |
|---|---|---|
| Chủ trì 20/20 test matrix | 84 | `docs/test-log.md` đầy đủ |
| Log mọi chuyến bay cuối | 87 | `logs/flight_YYYYMMDD_HHMM/` |
| Param versioning final | 88 | `params/07-final.param` |
| Chạy scenario GĐ 91 | 91 | Video demo 23 bước |

---

## Mẫu ghi log buổi bay

```markdown
## logs/flight_20260901_1430/notes.md

Wind: ~10 km/h từ Tây
Battery: 12.6V (100%), kết thúc 11.2V
Payload: drone + ESP32-CAM (~850g tổng)
Altitude max: 5m
Flight mode: Loiter → Auto → RTL
Problems: none
Changes since previous flight: geofence đặt 50m radius
```

---

## Checklist nhanh trước khi bay (in ra dán ở túi)

```text
[ ] Props chắc, đúng chiều CW/CCW
[ ] Battery điện áp > 12.0V
[ ] GPS: ≥ 8 satellites
[ ] Compass: không warning
[ ] Pre-arm: tất cả xanh
[ ] RC failsafe: đã test tuần trước
[ ] Sân: không có người lạ trong 30m
[ ] 3 người trở lên
[ ] P1 cầm RC, P2/P4 làm Observer
[ ] Tất cả biết điểm abort
```
