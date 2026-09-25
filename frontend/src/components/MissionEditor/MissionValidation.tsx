/**
 * Hai danh sách lỗi, đặt CẠNH nhau:
 *  - kiểm tra tại chỗ (`missionRules.ts`) — cập nhật theo từng phím gõ;
 *  - lỗi backend trả về ở lần nạp gần nhất — nguyên văn.
 *
 * Để cạnh nhau có chủ đích: nếu backend từ chối điều web cho qua thì hai bên
 * đã trôi khỏi nhau (plan §9.5.2), và người nhìn thấy ngay chỗ lệch.
 */
import { CircleAlert, ServerCrash } from "lucide-react";

import type { MissionIssue } from "@/lib/missionRules";
import { ERROR_CODE_LABEL } from "@/lib/protocol";

interface MissionValidationProps {
  issues: MissionIssue[] | null;
  backendErrors: string[];
  backendCode: string | null;
}

export function MissionValidation({ issues, backendErrors, backendCode }: MissionValidationProps) {
  const backendLabel = backendCode ? (ERROR_CODE_LABEL[backendCode as keyof typeof ERROR_CODE_LABEL] ?? backendCode) : null;

  return (
    <div className="space-y-2" data-testid="mission-validation">
      {issues === null ? (
        <p className="text-xs text-muted-foreground">Chưa nhận giới hạn an toàn từ backend — chưa kiểm được mission.</p>
      ) : issues.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-hud-red/40 bg-hud-red/[0.07] p-2 text-xs text-hud-red">
          {issues.map((i) => (
            <li key={`${i.seq}-${i.message}`} className="flex gap-1.5">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {i.message}
            </li>
          ))}
        </ul>
      ) : null}

      {backendErrors.length > 0 ? (
        <div className="rounded-md border border-hud-amber/40 bg-hud-amber/[0.07] p-2 text-xs text-hud-amber" data-testid="mission-backend-errors">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <ServerCrash className="size-3.5" aria-hidden />
            Backend từ chối lần nạp gần nhất{backendLabel ? ` — ${backendLabel}` : ""}
          </p>
          <ul className="list-disc space-y-0.5 pl-5">
            {backendErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
