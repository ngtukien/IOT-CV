# IOT-CV

Quadcopter S500 chạy ArduPilot, điều khiển qua web GCS tự viết, tránh vật cản bằng
TFmini Plus, và nhận diện người bằng mô hình AI chạy trên ảnh từ camera trên drone.

## Đang ở đâu

Tiến độ thật nằm ở **[`plans/PROGRESS.md`](plans/PROGRESS.md)** — nơi duy nhất ghi
phase nào xong, phase nào chưa. Không dùng công cụ theo dõi nào ngoài repo.

## Đọc gì trước

| Bạn muốn | Đọc file |
|---|---|
| Biết kế hoạch và thứ tự làm | [`plans/README.md`](plans/README.md) |
| Biết luật an toàn — **đọc trước khi chạm vào drone** | [`SAFETY.md`](SAFETY.md) |
| Hiểu một khái niệm từ con số 0 | [`docs/so-tay/`](docs/so-tay/) |

## Chạy thử nhanh

```bash
uv sync --extra dev                      # cài phụ thuộc backend (Python 3.13)
uv run pytest                            # chạy test
uv run uvicorn backend.app:app --port 8000   # backend ở http://127.0.0.1:8000

cd frontend && pnpm install && pnpm build    # build web GCS ra frontend/dist
docker compose up -d mosquitto           # MQTT broker cho phần IoT
```

## Cấu trúc thư mục

```
backend/     FastAPI + MAVLink + MQTT + vision — chạy native, không đóng gói Docker
frontend/    Vite + React + TypeScript; build ra frontend/dist, FastAPI phục vụ
firmware/    ArduPilot custom build + param, sketch camera ESP32, DroneBridge
ml/          Pipeline AI: dataset, huấn luyện, đánh giá (dự án uv riêng)
plans/       Kế hoạch 25 phase chính + 4 phase AI, và PROGRESS.md
docs/        so-tay/ giải thích cho người mới · archive/ tài liệu đã thay thế
deploy/      Cấu hình mosquitto
scripts/     Script tiện ích (SITL, bootstrap GitHub, GUI automation)
```

---

Kế hoạch 92 giai đoạn cũ đã chuyển sang
[`docs/archive/plan-nhap-92-giai-doan.md`](docs/archive/plan-nhap-92-giai-doan.md),
giữ làm tham khảo, không phải kế hoạch đang bám theo.
