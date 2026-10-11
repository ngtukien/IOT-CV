/**
 * Danh mục bản đồ nền — NGUỒN DUY NHẤT cho bản đồ 2D (Leaflet) và mặt đất 3D.
 *
 * Mọi URL đã kiểm ngày 25/09/2026 bằng cách TẢI Ô ẢNH VỀ VÀ NHÌN, không chỉ
 * nhìn mã HTTP: CARTO (basemaps.cartocdn.com) trả 200 + CORS đầy đủ nhưng nội
 * dung là ảnh "API KEY REQUIRED" — một "xanh giả" kinh điển, nên đã bị loại.
 * Các lớp dưới đây có ảnh thật + `Access-Control-Allow-Origin: *` (three.js cần
 * để dùng ảnh làm texture). `tile.openstreetmap.org` không trả lời từ máy dự án
 * hôm đó — giữ làm lựa chọn, không làm mặc định.
 *
 * Tất cả cần Internet. Ngoài thực địa không mạng: bản đồ nền trống, còn drone,
 * mission, rào ảo vẫn vẽ đúng (chúng không phụ thuộc ảnh nền); mặt đất 3D tự
 * chuyển sang lưới dựng sẵn.
 *
 * Esri World Imagery: dùng miễn phí cho mục đích không thương mại, BẮT BUỘC ghi
 * nguồn (attribution) — đã có trong từng lớp.
 */
export type MapBaseId = "streets" | "satellite" | "hybrid" | "topo" | "terrain" | "dark" | "light" | "osm";

export interface TileSource {
  url: string;
  subdomains?: string;
  maxNativeZoom: number;
  attribution: string;
}

export interface MapBaseDef {
  id: MapBaseId;
  label: string;
  hint: string;
  /** Lớp ảnh chính. */
  base: TileSource;
  /** Lớp phủ (nhãn đường, địa danh) vẽ trên lớp chính — cho "Vệ tinh + nhãn". */
  overlay?: TileSource;
  /** Nền tối → marker và nét vẽ cần viền sáng hơn. */
  dark: boolean;
}

const ESRI = "Ảnh: Esri, Maxar, Earthstar Geographics, cộng đồng GIS";
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const ESRI_CANVAS = "Bản đồ: Esri, HERE, Garmin, © OpenStreetMap";

export const MAP_BASES: readonly MapBaseDef[] = [
  {
    id: "streets",
    label: "Đường phố",
    hint: "Bản đồ đường phố có tên đường tiếng Việt (Esri World Street Map)",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 19,
      attribution: "Bản đồ: Esri, HERE, Garmin, USGS, © OpenStreetMap",
    },
    dark: false,
  },
  {
    id: "satellite",
    label: "Vệ tinh",
    hint: "Ảnh vệ tinh — nhìn thấy cây, mái nhà, bãi trống để chọn chỗ bay",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 19,
      attribution: ESRI,
    },
    dark: true,
  },
  {
    id: "hybrid",
    label: "Vệ tinh + nhãn",
    hint: "Ảnh vệ tinh phủ tên đường, địa danh",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 19,
      attribution: ESRI,
    },
    overlay: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 19,
      attribution: ESRI,
    },
    dark: true,
  },
  {
    id: "topo",
    label: "Địa hình",
    hint: "Bản đồ địa hình Esri: đường đồng mức, độ dốc, thảm thực vật",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 19,
      attribution: "Bản đồ: Esri, HERE, Garmin, USGS, NGA",
    },
    dark: false,
  },
  {
    id: "terrain",
    label: "OpenTopoMap",
    hint: "Địa hình kiểu bản đồ quân sự — tốt để xem độ cao địa hình (tối đa zoom 17)",
    base: {
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      subdomains: "abc",
      maxNativeZoom: 17,
      attribution: `${OSM}, SRTM · kiểu bản đồ &copy; OpenTopoMap (CC-BY-SA)`,
    },
    dark: false,
  },
  {
    id: "dark",
    label: "Tối",
    hint: "Nền xám tối ít chi tiết — dữ liệu bay nổi bật nhất, hợp theme Đêm",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 16,
      attribution: ESRI_CANVAS,
    },
    overlay: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 16,
      attribution: ESRI_CANVAS,
    },
    dark: true,
  },
  {
    id: "light",
    label: "Sáng",
    hint: "Nền xám sáng tối giản — đọc tốt ngoài nắng",
    base: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 16,
      attribution: ESRI_CANVAS,
    },
    overlay: {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}",
      maxNativeZoom: 16,
      attribution: ESRI_CANVAS,
    },
    dark: false,
  },
  {
    id: "osm",
    label: "OpenStreetMap",
    hint: "Bản đồ OSM gốc",
    base: {
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      maxNativeZoom: 19,
      attribution: OSM,
    },
    dark: false,
  },
];

export function mapBase(id: string): MapBaseDef {
  return MAP_BASES.find((b) => b.id === id) ?? MAP_BASES[0];
}

/** URL cụ thể của một ô ảnh (cho mặt đất 3D). `{r}` = "" (không dùng ảnh @2x). */
export function tileUrl(src: TileSource, z: number, x: number, y: number): string {
  const subs = src.subdomains ?? "";
  const s = subs ? subs[Math.abs(x + y) % subs.length] : "";
  return src.url.replace("{s}", s).replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y)).replace("{r}", "");
}
