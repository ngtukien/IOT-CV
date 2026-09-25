# Web GCS v2 — trạm mặt đất trên trình duyệt

Vite + React 19 + TypeScript + Tailwind v4 + shadcn (radix). Backend FastAPI (`backend/`)
phục vụ bản build `dist/` ở cổng 8000 và trả `index.html` cho mọi trang con, nên F5 ở
`/mission` hay `/3d` vẫn đúng.

## Chạy

```bash
pnpm install
pnpm dev          # Vite ở 5173, proxy /api và /ws sang backend 8000
pnpm build        # tsc -b + vite build → dist/ (backend phục vụ)
pnpm test         # vitest (unit, không cần SITL)
pnpm lint         # oxlint
pnpm e2e          # Playwright — CẦN SITL + backend đang chạy, xem tests/e2e/
pnpm gen:protocol # sinh src/lib/protocol.ts từ backend/ws-contract.schema.json
```

Hợp đồng WebSocket/REST: `plans/phase-05-*.md` → `backend/schemas.py` →
`backend/ws-contract.schema.json` → `pnpm gen:protocol`, đổi cùng một commit.

## Trang

Danh sách trang là SSOT ở `src/app/routes.tsx` (đường dẫn, nhãn, nhóm, icon, phím
`Alt+1…0`). Thanh điều hướng, phím tắt và hộp "Phím tắt (?)" đều đọc từ đó.

| Đường dẫn | Trang | Nội dung |
|---|---|---|
| `/` | Bay | HUD + PFD, bản đồ/3D chuyển qua lại, video + vật cản, mode, lái tay WASD |
| `/mission` | Nhiệm vụ | Soạn lộ trình (kéo điểm, chèn giữa, hoàn tác), mẫu, thư viện, hồ sơ độ cao, nạp/đọc lại |
| `/3d` | Không gian 3D | Bản sao số bám telemetry (5 góc máy) và Xưởng linh kiện (tháo rời S500) |
| `/vision` | Camera & AI | Video lớn, box nhận diện, ảnh chụp |
| `/overview` | Tổng quan | Sức khoẻ hệ thống, drone mô hình, kiểm tra trước bay tóm tắt |
| `/telemetry` | Dữ liệu bay | Biểu đồ uPlot theo thời gian, xuất CSV |
| `/logs` | Nhật ký | Sự kiện, lọc, đánh dấu đã xem |
| `/preflight` | Kiểm tra trước bay | Kiểm tự động từ telemetry + danh mục tay (hết hạn 6 h) |
| `/system` | Hệ thống | `/api/system`, giới hạn an toàn, kết nối |
| `/settings` | Cài đặt | Theme, chuyển động, bản đồ nền, 3D, âm thanh cảnh báo |

**Một WebSocket cho cả phiên**: mở ở `App` (`GlobalServices`), không đóng khi đổi
trang. Các hook toàn cục (dead-man, phím giữ, đọc lại mission, thông báo bằng giọng)
cũng sống ở đó, nên rời trang Bay giữa lúc giữ W vẫn dừng đúng. `tests/e2e/pages.spec.ts`
kiểm điều này.

## Hệ thiết kế HORIZON

- Token màu ở `src/index.css` (oklch, `@theme inline`): theme **Đêm** (mặc định,
  `.dark`) và **Ngày** (đọc ngoài nắng). Màu mang nghĩa hàng không: cyan = thông tin,
  xanh lá = ổn, hổ phách = cảnh báo/bản nháp, đỏ = nguy hiểm, tím = AI.
- Màu chuỗi biểu đồ `--series-1/2` đã qua kiểm mù màu (`validate_palette.js`).
- Hiệu ứng dùng chung ở `src/styles/effects.css` (`.panel`, `.panel-instrument`,
  `.glass-fixed`, `.hatch`, `.num`…). Tắt chuyển động ở Cài đặt → `html[data-motion=off]`.
- Icon riêng: `src/components/icons/index.tsx`. Font: Chakra Petch (tiêu đề) + Geist (chữ, số).

## 3D (`src/components/twin/`)

three.js qua @react-three/fiber + drei + postprocessing. Toạ độ ENU → cảnh:
x = đông, y = lên, z = −bắc (`src/lib/enu.ts`).

| File | Vai trò |
|---|---|
| `TwinScene.tsx` | Cảnh chính: ánh sáng theo giờ, camera, hậu kỳ, mức chất lượng |
| `DroneModel.tsx` | S500 dựng bằng hình học, tháo rời được, có nhãn linh kiện |
| `SceneParts.tsx` | Mặt đất ô ảnh z19, bãi đáp, rào ảo, mission, vệt bay, tia TFmini |
| `FieldProps.tsx` | Trạm mặt đất, người vận hành, lều, cọc tiêu, ống gió, mây |
| `FieldScenery.tsx` | Rừng cây (instanced), đồi xa, xe, máy phát, cột đèn, đèn bãi đáp |
| `DroneHangar.tsx` | Xưởng: studio, sàn phản chiếu, hoạt ảnh tháo/lắp |
| `labels.tsx` | Nhãn DOM chiếu từ 3D (thay `<Html>` của drei) |
| `gpu.ts` | Phát hiện vẽ bằng CPU → tự hạ chất lượng |

Những bẫy đã sập thật, đừng lặp lại:

1. **Không dùng `DepthOfField`** và **không đổi props hậu kỳ theo góc máy.** DOF đọc
   độ sâu tuyến tính, hỏng với `logarithmicDepthBuffer`; đổi props thì EffectComposer
   biên dịch lại shader và màn hình đen từng lúc.
2. **Shader tự viết phải chặn NaN** (`pow` của số âm, `smoothstep` cạnh đảo ngược,
   `normalize` vector 0). Một điểm ảnh NaN qua Bloom loang ra đen cả khung. Nó cũng
   phải có chunk `logdepthbuf_*`.
3. **Không dùng `<Html>` của drei**: mỗi nhãn là một React root, rời trang 3D là lỗi
   `removeChild`. Dùng `SceneLabel` + `LabelOverlay`.
4. **Không để DPR tự nhảy** (`PerformanceMonitor`): canvas vẽ lại cỡ mới, người dùng
   thấy nháy.
5. Playwright mặc định vẽ WebGL bằng CPU; `playwright.config.ts` đã bật GPU thật.

## Kiểm thử

- `tests/unit/` — logic thuần và component (routeTools, mission editing, HUD, vẽ box nhận diện…).
- `tests/e2e/` — chạy tay trên SITL trước mỗi buổi bay thật
  (`docs/so-tay/10-web-dieu-khien-obstacle-video.md`). Bài #5 (mất tiêu điểm cửa sổ)
  phải chạy `--headed`: headless không có focus giữa các cửa sổ.
