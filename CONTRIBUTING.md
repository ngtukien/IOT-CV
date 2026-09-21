# Contributing

Repo này là đồ án UAV (IoT + Xử lý ảnh). Kế hoạch triển khai đầy đủ nằm ở
[README.md](README.md) — 92 giai đoạn, mỗi giai đoạn có tiêu chí nghiệm thu riêng
(gọi là **CỔNG PASS**).

## Nguyên tắc số 1: không nhảy giai đoạn

Mỗi chức năng phải đi theo đúng thứ tự:

```text
SIMULATION -> BENCH TEST -> GROUND TEST -> LOW ALTITUDE FLIGHT -> FULL DEMO
```

Không merge code bay thật khi chưa pass được trên SITL. Xem thêm [SAFETY.md](SAFETY.md).

## Commit convention

Theo GIAI ĐOẠN 89 — commit theo từng milestone, không dồn cả tháng vào một commit
`final project`.

| Prefix | Dùng khi |
|---|---|
| `feat:` | thêm chức năng (backend, frontend, ml, esp32) |
| `fix:` | sửa bug |
| `test:` | thêm/sửa test |
| `docs:` | tài liệu, test log, kết quả experiment |
| `chore:` | cấu hình, script, dependency |
| `ci:` | GitHub Actions |
| `param:` | thay đổi parameter ArduPilot (kèm file trong `params/`) |

Ví dụ:

```bash
git commit -m "feat: connect backend to SITL"
git commit -m "feat: stream UAV telemetry to web"
git commit -m "feat: add guided velocity control"
git commit -m "param: save loiter-good parameter snapshot"
```

## Branch

- `main` — luôn ở trạng thái chạy được với SITL.
- `feat/<mô-tả-ngắn>` — cho mỗi giai đoạn hoặc issue.

## Pull request

PR template sẽ hỏi ba câu quan trọng, đừng bỏ trống:

1. Giai đoạn (README) và issue liên quan.
2. **CỔNG PASS nào đã chạy thật** — kèm output/ảnh/log.
3. Có ảnh hưởng tới safety hay không (mode, failsafe, dead-man timeout, geofence,
   pre-arm check, motor output).

## Trước khi push

```bash
make lint
make test
```

Cả hai phải xanh. CI sẽ chạy lại đúng hai lệnh này.

## Những gì không commit

`.gitignore` đã chặn sẵn, nhưng nhắc lại: không commit dataset (`ml/datasets/`),
weights (`*.pt`), flight log nhị phân (`*.BIN`, `*.tlog`), ảnh snapshot detection,
`.env`, và **không commit source ArduPilot** (`ardupilot/` — clone vào `~/ardupilot`
**trong WSL**, xem [plans/phase-02-wsl2-sitl.md](plans/phase-02-wsl2-sitl.md) việc 02.2).

Ngược lại, `params/*.param` **phải** được commit — đó là lịch sử cấu hình flight
controller theo GIAI ĐOẠN 88.
