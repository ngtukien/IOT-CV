/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  LUẬT VÀNG (mang từ `frontend/map.js` bản vanilla):                       ║
 * ║  "KHÔNG tạo marker mới mỗi lần telemetry về — chỉ setLatLng marker cũ."   ║
 * ║                                                                          ║
 * ║  Trong React: `<Marker>` là MỘT phần tử, chỉ đổi prop `position`. ĐỪNG    ║
 * ║  đặt `key={Date.now()}` hay `key={lat + lon}` — khoá mới làm React tháo   ║
 * ║  marker cũ và gắn marker mới 8 lần mỗi giây: bản đồ giật và rò bộ nhớ.    ║
 * ║  Heading cũng không đổi icon: icon tạo một lần (`icons.ts`), mũi xoay    ║
 * ║  bằng cách sửa `style.transform` của phần tử con trong icon đó.           ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * `heading` của telemetry: độ, 0 = Bắc, tăng theo chiều kim đồng hồ — trùng quy
 * ước của CSS `rotate()`, nên dùng thẳng, không đổi dấu.
 */
import type L from "leaflet";
import { useEffect, useRef } from "react";
import { Marker } from "react-leaflet";

import { hasValue } from "@/lib/format";
import { useTelemetryStore } from "@/store/telemetry";

import { DRONE_ICON_ARROW, DRONE_ICON_DOT, DRONE_ROTOR_ATTR } from "./icons";

export function DroneMarker() {
  const lat = useTelemetryStore((s) => s.telemetry?.lat ?? null);
  const lon = useTelemetryStore((s) => s.telemetry?.lon ?? null);
  const heading = useTelemetryStore((s) => s.telemetry?.heading ?? null);
  const markerRef = useRef<L.Marker>(null);
  const hasHeading = hasValue(heading);

  useEffect(() => {
    if (!hasHeading) return;
    const el = markerRef.current?.getElement()?.querySelector<HTMLElement>(`[${DRONE_ROTOR_ATTR}]`);
    if (el) el.style.transform = `rotate(${heading}deg)`;
  }, [heading, hasHeading, lat, lon]);

  if (!hasValue(lat) || !hasValue(lon)) return null;

  return (
    <Marker
      ref={markerRef}
      position={[lat, lon]}
      icon={hasHeading ? DRONE_ICON_ARROW : DRONE_ICON_DOT}
      interactive={false}
      keyboard={false}
      zIndexOffset={1000}
    />
  );
}
