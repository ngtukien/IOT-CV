/**
 * Vẽ lộ trình bằng `terra-draw` rồi đổi mỗi đỉnh thành một waypoint NHÁP
 * (plan Phase 09 §9.4.2, cách 2 — cách 1 là bấm từng điểm).
 *
 * Cách dùng: bấm từng đỉnh; bấm lại đỉnh cuối hoặc nhấn Enter để xong; Esc để
 * huỷ nét đang vẽ. Nét vừa xong bị xoá khỏi terra-draw ngay: từ đó nó là các
 * waypoint trong bản nháp, đi đúng một đường với điểm bấm tay — bảng soạn,
 * kiểm tra tại chỗ, nút NẠP. Vẽ không bao giờ gửi gì xuống drone.
 *
 * Không có ngưỡng nào ở đây: vẽ nhiều đỉnh hơn `max_waypoints` thì luật 6 báo
 * lỗi ở bảng, KHÔNG cắt bớt im lặng.
 *
 * Vòng đời gắn vào effect và cleanup luôn `stop()`: React 19 StrictMode chạy
 * effect hai lần ở dev, thiếu cleanup là hai bộ vẽ cùng nghe một bản đồ.
 *
 * Effect CHỈ phụ thuộc `active` và `map`. Giới hạn đọc từ store lúc nét vẽ
 * xong, `onDone` giữ trong ref: nếu để chúng vào danh sách phụ thuộc thì mỗi gói
 * `status` mới (object `limits` mới) dựng lại terra-draw và xoá nét đang vẽ dở.
 */
import L from "leaflet";
import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import { TerraDraw, TerraDrawLineStringMode } from "terra-draw";
import { TerraDrawLeafletAdapter } from "terra-draw-leaflet-adapter";

import { routeToPoints } from "@/lib/geo";
import { effectiveDefaultAlt, useMissionStore } from "@/store/mission";
import { useTelemetryStore } from "@/store/telemetry";

/** Tên chế độ vẽ — chính là `mode` mặc định của TerraDrawLineStringMode. */
const LINE_MODE = "linestring";

/**
 * 7 chữ số thập phân = độ phân giải của MAVLink (toạ độ nguyên nhân 1e7, một
 * đơn vị ≈ 1 cm). Nhiều hơn là số giả, ít hơn là làm lệch điểm người vẽ.
 */
const COORDINATE_PRECISION = 7;

/**
 * Bấm cách đỉnh cuối trong chừng này pixel = "kết thúc nét". Mặc định của
 * terra-draw là 40 px; ở zoom 17 một pixel ≈ 1 m, tức đỉnh mới nào gần đỉnh
 * trước dưới ~40 m cũng bị hiểu là lệnh kết thúc — mission trong vòng 50 m
 * gần như không vẽ nổi quá 3 đỉnh (gặp thật trên SITL 25/09/2026).
 */
const FINISH_POINTER_PX = 12;

/** Màu nét đang vẽ — cùng tông vàng với lớp bản nháp (terra-draw chỉ nhận hex). */
const DRAW_COLOR = "#f2b53a";

interface RouteDrawControlProps {
  active: boolean;
  /** Gọi sau khi một lộ trình đã thành waypoint — để tắt chế độ vẽ. */
  onDone(added: number): void;
}

export function RouteDrawControl({ active, onDone }: RouteDrawControlProps) {
  const map = useMap();
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!active) return;

    const draw = new TerraDraw({
      adapter: new TerraDrawLeafletAdapter({ lib: L, map, coordinatePrecision: COORDINATE_PRECISION }),
      modes: [
        new TerraDrawLineStringMode({
          pointerDistance: FINISH_POINTER_PX,
          styles: {
            lineStringColor: DRAW_COLOR,
            lineStringWidth: 3,
            coordinatePointColor: DRAW_COLOR,
            closingPointColor: DRAW_COLOR,
          },
        }),
      ],
    });
    draw.start();
    draw.setMode(LINE_MODE);

    draw.on("finish", (id, context) => {
      if (context.action !== "draw") return;
      const feature = draw.getSnapshotFeature(id);
      draw.clear();
      if (!feature || feature.geometry.type !== "LineString") return;
      const points = routeToPoints(feature.geometry.coordinates);
      const limits = useTelemetryStore.getState().status?.limits ?? null;
      const { addWaypoints, defaultAlt } = useMissionStore.getState();
      addWaypoints(points, effectiveDefaultAlt(defaultAlt, limits));
      // Báo xong ở tick SAU. terra-draw kết thúc nét ở `pointerup`, còn sự
      // kiện `click` của CHÍNH cú bấm đó tới sau: báo ngay thì chế độ vẽ đã
      // tắt, và cú click đó lọt sang "bấm để thêm điểm" thành một waypoint thừa
      // (gặp thật trên SITL 25/09/2026: vẽ 3 đỉnh, bảng hiện 4).
      setTimeout(() => onDoneRef.current(points.length), 0);
    });

    return () => {
      draw.stop();
    };
  }, [active, map]);

  return null;
}
