/**
 * Biểu đồ thời gian thực (uPlot, canvas — nhanh ở hàng nghìn điểm).
 *
 * Luật dataviz của dự án: MỘT trục đứng mỗi biểu đồ, tối đa HAI chuỗi cùng đơn
 * vị (màu `--series-1`, `--series-2` đã qua bộ kiểm màu cho người mù màu), luôn
 * có chú giải khi ≥ 2 chuỗi, rê chuột = đường dóng + số của từng chuỗi. Chữ và
 * số dùng màu chữ, không dùng màu chuỗi.
 *
 * Dữ liệu kéo từ `store/history.ts` theo nhịp riêng (mặc định 2 lần/giây) —
 * không theo nhịp 8 Hz của telemetry. `null` = mất số đo → nét BỊ NGẮT.
 */
import { useEffect, useMemo, useRef } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";

import { useResolvedTheme } from "@/hooks/useApplySettings";
import type { Telemetry } from "@/lib/protocol";
import { telemetryHistory, useHistoryTick } from "@/store/history";

export interface ChartSeries {
  label: string;
  pick(d: Telemetry): number | null | undefined;
  /** "1" | "2" → `--series-1` / `--series-2`. */
  slot: 1 | 2;
}

interface TimeChartProps {
  series: readonly ChartSeries[];
  unit: string;
  windowSec: number;
  paused?: boolean;
  height?: number;
  /** Giới hạn trục đứng cố định (vd pin 0–100 %). Bỏ trống = tự co giãn. */
  range?: [number, number];
  digits?: number;
  label: string;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "#888";
}

function buildData(series: readonly ChartSeries[], windowSec: number): uPlot.AlignedData {
  const since = Date.now() - windowSec * 1000;
  const samples = telemetryHistory.samples(since);
  const xs = samples.map((s) => s.t / 1000);
  const ys = series.map((sr) =>
    samples.map((s) => {
      const v = sr.pick(s.d);
      return typeof v === "number" && Number.isFinite(v) ? v : null;
    }),
  );
  return [xs, ...ys] as uPlot.AlignedData;
}

export function TimeChart({ series, unit, windowSec, paused = false, height = 170, range, digits = 1, label }: TimeChartProps) {
  const host = useRef<HTMLDivElement>(null);
  const plot = useRef<uPlot | null>(null);
  const version = useHistoryTick(500);
  const theme = useResolvedTheme();
  const key = useMemo(() => series.map((s) => s.label).join("|"), [series]);

  // Dựng lại khi đổi chuỗi hoặc đổi theme (màu đọc từ token lúc dựng).
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const axisStroke = cssVar("--muted-foreground");
    const grid = { stroke: "color-mix(in oklch, currentColor 9%, transparent)", width: 1 } as uPlot.Axis.Grid;
    const opts: uPlot.Options = {
      width: el.clientWidth || 600,
      height,
      padding: [8, 8, 0, 0],
      cursor: { drag: { x: false, y: false }, points: { size: 7 } },
      legend: { show: true, live: true },
      scales: { x: { time: true }, y: range ? { range } : { auto: true } },
      axes: [
        {
          stroke: axisStroke,
          grid,
          ticks: { show: false },
          font: "11px Geist Mono Variable, monospace",
          space: 80,
          // Giờ 24h kiểu Việt Nam; cửa sổ ngắn thì có cả giây.
          values: (_u, vals) =>
            vals.map((v) => (v == null ? "" : new Date(v * 1000).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: windowSec <= 300 ? "2-digit" : undefined }))),
        },
        // Trục đứng để uPlot tự chọn số lẻ theo khoảng giá trị: ép `digits` ở đây
        // làm trục độ cao 0,01 m in toàn "0".
        { stroke: axisStroke, grid, ticks: { show: false }, font: "11px Geist Mono Variable, monospace", size: 56 },
      ],
      series: [
        { label: "Giờ", value: (_u, v) => (v == null ? "—" : new Date(v * 1000).toLocaleTimeString("vi-VN")) },
        ...series.map((s) => ({
          label: s.label,
          stroke: cssVar(s.slot === 1 ? "--series-1" : "--series-2"),
          width: 2,
          spanGaps: false,
          points: { show: false },
          value: (_u: uPlot, v: number | null) => (v == null ? "—" : `${v.toFixed(digits)} ${unit}`),
        })),
      ],
    };
    plot.current = new uPlot(opts, buildData(series, windowSec), el);
    const ro = new ResizeObserver(() => plot.current?.setSize({ width: el.clientWidth, height }));
    ro.observe(el);
    return () => {
      ro.disconnect();
      plot.current?.destroy();
      plot.current = null;
    };
    // `series` so theo `key` (nhãn) — hàm pick là hằng trong trang.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, height, unit, digits, theme, windowSec, range?.[0], range?.[1]]);

  useEffect(() => {
    if (paused || !plot.current) return;
    plot.current.setData(buildData(series, windowSec));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, windowSec, paused]);

  return <div ref={host} className="uplot-host w-full" role="img" aria-label={label} />;
}
