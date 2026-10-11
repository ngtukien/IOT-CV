/**
 * Xuất CSV cho Excel/LibreOffice: dấu phẩy, mọi ô chứa dấu phẩy/nháy/xuống dòng
 * được bọc nháy kép, BOM UTF-8 ở đầu để Excel đọc đúng tiếng Việt.
 */
export function toCsv(headers: readonly string[], rows: readonly (readonly unknown[])[]): string {
  const cell = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "number" ? (Number.isFinite(v) ? String(v) : "") : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `﻿${[headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n")}\r\n`;
}

export function downloadText(name: string, text: string, type = "text/plain"): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
