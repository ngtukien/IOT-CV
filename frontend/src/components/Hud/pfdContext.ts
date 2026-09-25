/**
 * Một trang có thể có HAI màn hình bay (bản lớn ở trang Bay + bản nhỏ phủ trên
 * khung 3D). Hai việc phải tách theo từng bản:
 *  - `data-testid` chỉ gắn cho bản CHÍNH (`instrumented`) — E2E đọc số từ đó,
 *    hai phần tử cùng testid là locator trùng;
 *  - id của `clipPath`/`pattern` SVG phải khác nhau giữa hai bản (`prefix`).
 */
import { createContext, useContext } from "react";

export interface PfdIds {
  prefix: string;
  instrumented: boolean;
}

export const PfdIdContext = createContext<PfdIds>({ prefix: "pfd", instrumented: true });

export function usePfdIds(): PfdIds {
  return useContext(PfdIdContext);
}

/** testid khi là bản chính, `undefined` khi là bản phụ. */
export function useTestId(id: string): string | undefined {
  return useContext(PfdIdContext).instrumented ? id : undefined;
}
