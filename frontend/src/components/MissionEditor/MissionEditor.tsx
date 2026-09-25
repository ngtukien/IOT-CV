/**
 * Trình soạn mission (plan Phase 09 §9.4–9.6).
 *
 * Bảng luôn có CẤT CÁNH ở đầu và VỀ NHÀ/HẠ CÁNH ở cuối — hai dòng cố định, chỉ
 * sửa được, không xoá được. Người dùng không thể soạn ra mission vi phạm luật
 * 7–8; backend vẫn kiểm đủ (nó là cổng chặn thật).
 *
 * Nút NẠP MISSION bị khoá khi còn lỗi hoặc máy bay chưa sẵn sàng, và tooltip
 * nói rõ vì sao — nút xám không có lý do là điều gây bực nhất cho người mới.
 */
import { ArrowDownUp, CloudUpload, Redo2, Trash2, Undo2 } from "lucide-react";
import { useEffect } from "react";

import { IconRoute } from "@/components/icons";
import type { CSSProperties } from "react";

import { Panel } from "@/components/Panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { startMissionUpload } from "@/hooks/missionUplink";
import { useLimits } from "@/hooks/useLimits";
import { useHome, useMissionDraft } from "@/hooks/useMissionDraft";
import { formatClock } from "@/lib/format";
import { haversineM } from "@/lib/geo";
import { MAV_CMD, uploadBlockers } from "@/lib/missionRules";
import { cn } from "@/lib/utils";
import { isUploading, sameMission, useMissionStore } from "@/store/mission";
import type { FinalCommand, UploadState } from "@/store/mission";
import { useTelemetryStore } from "@/store/telemetry";

import { AltField } from "./AltField";
import { MissionValidation } from "./MissionValidation";
import { RowShell, WaypointActions } from "./WaypointRow";

function fmtCoord(v: number): string {
  return v.toFixed(6);
}

function useBlockers(): string[] {
  const socketOpen = useTelemetryStore((s) => s.connection === "open");
  const limitsKnown = useTelemetryStore((s) => s.status?.limits != null);
  const fcConnected = useTelemetryStore((s) => s.telemetry?.connected ?? s.status?.connected ?? false);
  const gpsFixType = useTelemetryStore((s) => s.telemetry?.gps_fix_type ?? null);
  const ekfOk = useTelemetryStore((s) => s.telemetry?.ekf_ok ?? null);
  const home = useHome();
  return uploadBlockers({ socketOpen, limitsKnown, fcConnected, gpsFixType, ekfOk, home });
}

function uploadStatusText(state: UploadState, progress: { sent: number; total: number } | null, count: number): string | null {
  switch (state) {
    case "validating":
      return "Đang kiểm tra…";
    case "uploading":
      return progress ? `Đang nạp ${progress.sent}/${progress.total}` : "Backend đã nhận, đang nạp…";
    case "reading-back":
      return "Đang đọc lại từ FC…";
    case "done":
      return `Đã nạp xong (${count} item)`;
    default:
      return null;
  }
}

function progressValue(state: UploadState, progress: { sent: number; total: number } | null): number {
  if (state === "reading-back" || state === "done") return 100;
  if (!progress || progress.total === 0) return 0;
  return (progress.sent / progress.total) * 100;
}

function FinalCommandToggle({ value, onChange }: { value: FinalCommand; onChange(c: FinalCommand): void }) {
  const options: [FinalCommand, string][] = [
    [MAV_CMD.NAV_RETURN_TO_LAUNCH, "VỀ NHÀ (RTL)"],
    [MAV_CMD.NAV_LAND, "HẠ CÁNH"],
  ];
  return (
    <div role="radiogroup" aria-label="Cách kết thúc mission" className="inline-flex rounded-md border border-border p-0.5">
      {options.map(([cmd, label]) => (
        <button
          key={cmd}
          type="button"
          role="radio"
          aria-checked={value === cmd}
          onClick={() => onChange(cmd)}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-semibold tracking-wide transition-colors",
            value === cmd ? "bg-hud-cyan/20 text-hud-cyan" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/** Dòng trạng thái mission FC đang giữ + so với bản nháp. */
function LoadedMissionLine({ draftItems }: { draftItems: Parameters<typeof sameMission>[0] }) {
  const source = useTelemetryStore((s) => s.status?.mission?.source ?? null);
  const readback = useMissionStore((s) => s.readback);

  if (source === "local") {
    return (
      <p className="text-xs text-hud-amber" data-testid="mission-loaded-line">
        FC đã nhận mission nhưng đọc lại CHƯA khớp — không vẽ, không được bay mission này.
      </p>
    );
  }
  if (!readback) {
    return (
      <p className="text-xs text-muted-foreground" data-testid="mission-loaded-line">
        Chưa có mission nào được nạp và đọc lại từ FC.
      </p>
    );
  }
  const same = sameMission(draftItems, readback.waypoints);
  return (
    <div className="space-y-0.5 text-xs" data-testid="mission-loaded-line">
      <p className="text-hud-green">
        Nạp lúc {formatClock(readback.uploadedAt)} · {readback.waypoints.length} item · đã đọc lại từ FC
      </p>
      <p className={same ? "text-muted-foreground" : "text-hud-amber"} data-testid="mission-draft-compare">
        {same ? "Bản nháp trùng với mission đã nạp." : "Bản nháp KHÁC mission đã nạp — FC vẫn giữ bản cũ cho tới khi nạp lại."}
      </p>
    </div>
  );
}

/** Ctrl+Z / Ctrl+Y (hoặc Ctrl+Shift+Z) hoàn tác bản nháp — trừ khi đang gõ vào ô nhập. */
function useUndoShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      const store = useMissionStore.getState();
      if (e.code === "KeyZ" && !e.shiftKey) {
        e.preventDefault();
        store.undo();
      } else if (e.code === "KeyY" || (e.code === "KeyZ" && e.shiftKey)) {
        e.preventDefault();
        store.redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function DraftToolbar() {
  const canUndo = useMissionStore((s) => s.past.length > 0);
  const canRedo = useMissionStore((s) => s.future.length > 0);
  const count = useMissionStore((s) => s.waypoints.length);
  const defaultAlt = useMissionStore((s) => s.defaultAlt);
  const busy = useMissionStore((s) => isUploading(s.uploadState));
  const store = useMissionStore.getState();
  return (
    <div className="flex flex-wrap items-center gap-1" role="toolbar" aria-label="Sửa bản nháp">
      <Button size="xs" variant="outline" disabled={!canUndo || busy} onClick={() => store.undo()} title="Hoàn tác (Ctrl+Z)">
        <Undo2 aria-hidden /> Hoàn tác
      </Button>
      <Button size="xs" variant="outline" disabled={!canRedo || busy} onClick={() => store.redo()} title="Làm lại (Ctrl+Y)">
        <Redo2 aria-hidden /> Làm lại
      </Button>
      <Button size="xs" variant="outline" disabled={count < 2 || busy} onClick={() => store.reverse()} title="Bay ngược lộ trình">
        <ArrowDownUp aria-hidden /> Đảo chiều
      </Button>
      <Button
        size="xs"
        variant="outline"
        disabled={count === 0 || busy || Number.isNaN(defaultAlt)}
        onClick={() => store.setAllAlt(defaultAlt)}
        title="Đặt mọi waypoint về độ cao cho điểm mới"
      >
        Đặt mọi điểm = {Number.isNaN(defaultAlt) ? "—" : `${defaultAlt} m`}
      </Button>
    </div>
  );
}

export function MissionEditor({ style, className }: { style?: CSSProperties; className?: string }) {
  useUndoShortcuts();
  const limits = useLimits();
  const home = useHome();
  const { items, issues, badSeqs } = useMissionDraft();
  const blockers = useBlockers();

  const takeoffAlt = useMissionStore((s) => s.takeoffAlt);
  const waypoints = useMissionStore((s) => s.waypoints);
  const finalCommand = useMissionStore((s) => s.finalCommand);
  const defaultAlt = useMissionStore((s) => s.defaultAlt);
  const uploadState = useMissionStore((s) => s.uploadState);
  const uploadProgress = useMissionStore((s) => s.uploadProgress);
  const lastErrors = useMissionStore((s) => s.lastErrors);
  const lastErrorCode = useMissionStore((s) => s.lastErrorCode);
  const missionSource = useTelemetryStore((s) => s.status?.mission?.source ?? null);
  const actions = useMissionStore.getState();

  const busy = isUploading(uploadState);
  const lockReasons = [
    ...(busy ? ["Đang nạp mission — chờ xong"] : []),
    ...blockers,
    ...(issues && issues.length > 0 ? [`Mission còn ${issues.length} lỗi (xem danh sách bên dưới)`] : []),
  ];
  const canUpload = lockReasons.length === 0;
  const statusText = uploadStatusText(uploadState, uploadProgress, items.length);
  const finalSeq = items.length;

  return (
    <Panel
      title="Soạn mission"
      subtitle="Cất cánh → các điểm → về nhà / hạ cánh"
      icon={IconRoute}
      style={style}
      className={className}
      testId="mission-panel"
      bodyClassName="flex flex-col gap-3 p-3"
      actions={
        missionSource === "local" ? (
          <Badge className="border-hud-amber/40 bg-hud-amber/15 text-hud-amber" data-testid="mission-unconfirmed">
            Chưa xác nhận
          </Badge>
        ) : missionSource === "readback" ? (
          <Badge className="border-hud-green/40 bg-hud-green/15 text-hud-green">FC đã xác nhận</Badge>
        ) : null
      }
    >
      {!home ? (
        <p className="rounded-md border border-hud-amber/40 bg-hud-amber/[0.07] px-2 py-1.5 text-xs text-hud-amber" data-testid="mission-no-home">
          Chưa có điểm home — arm drone hoặc chờ GPS fix. Không có home thì không kiểm được khoảng cách, và chưa nạp được.
        </p>
      ) : null}

      <DraftToolbar />

      <div className="flex flex-wrap items-center gap-2">
        <Label className="text-xs text-muted-foreground">Độ cao cho điểm mới</Label>
        <AltField value={defaultAlt} onChange={actions.setDefaultAlt} limits={limits} label="Độ cao cho điểm mới" />
        <span className="ml-auto text-[11px] text-muted-foreground">
          {limits ? `Giới hạn ${limits.min_alt}–${limits.max_alt} m · tối đa ${limits.max_waypoints} item` : "Chưa có giới hạn"}
        </span>
      </div>

      <ol className="space-y-1" data-testid="mission-rows">
        <RowShell
          fixed
          seq={1}
          testId="mission-row-takeoff"
          invalid={badSeqs.has(1)}
          title="CẤT CÁNH"
          detail="tại chỗ, thẳng đứng"
          alt={<AltField value={takeoffAlt} onChange={actions.setTakeoffAlt} limits={limits} invalid={badSeqs.has(1)} label="Độ cao cất cánh" />}
        />
        {waypoints.map((w, i) => {
          const seq = i + 2;
          const dist = home ? haversineM(home[0], home[1], w.lat, w.lon) : null;
          return (
            <RowShell
              key={w.id}
              seq={seq}
              testId="mission-row-wp"
              invalid={badSeqs.has(seq)}
              title="WAYPOINT"
              detail={
                <>
                  {fmtCoord(w.lat)}, {fmtCoord(w.lon)}
                  {dist === null ? null : ` · ${dist.toFixed(0)} m tới home`}
                </>
              }
              alt={
                <AltField
                  value={w.alt}
                  onChange={(alt) => actions.updateAlt(w.id, alt)}
                  limits={limits}
                  invalid={badSeqs.has(seq)}
                  label={`Độ cao WP${seq}`}
                  testId={`alt-${seq}`}
                />
              }
              actions={
                <WaypointActions
                  seq={seq}
                  isFirst={i === 0}
                  isLast={i === waypoints.length - 1}
                  onMove={(dir) => actions.move(w.id, dir)}
                  onRemove={() => actions.remove(w.id)}
                />
              }
            />
          );
        })}
        {waypoints.length === 0 ? (
          <li className="rounded-md border border-dashed border-border px-2 py-2 text-center text-xs text-muted-foreground">
            Bấm lên bản đồ, vẽ lộ trình, hoặc chọn một mẫu lộ trình để thêm waypoint.
          </li>
        ) : null}
        <RowShell
          fixed
          seq={finalSeq}
          testId="mission-row-final"
          invalid={badSeqs.has(finalSeq)}
          title={finalCommand === MAV_CMD.NAV_LAND ? "HẠ CÁNH" : "VỀ NHÀ (RTL)"}
          detail={finalCommand === MAV_CMD.NAV_LAND ? "hạ tại điểm cuối" : "bay về điểm home rồi hạ"}
          alt={<FinalCommandToggle value={finalCommand} onChange={actions.setFinalCommand} />}
        />
      </ol>

      <MissionValidation issues={issues} backendErrors={uploadState === "error" ? lastErrors : []} backendCode={lastErrorCode} />

      <div className="mt-auto space-y-2 border-t border-border pt-3">
        {statusText ? (
          <div className="space-y-1" data-testid="mission-upload-status" data-state={uploadState}>
            <p className={cn("text-xs font-medium", uploadState === "done" ? "text-hud-green" : "text-hud-cyan")}>{statusText}</p>
            <Progress value={progressValue(uploadState, uploadProgress)} />
          </div>
        ) : null}
        <LoadedMissionLine draftItems={items} />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={waypoints.length === 0 || busy}
            onClick={() => actions.clear()}
          >
            <Trash2 aria-hidden />
            Xoá bản nháp
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              {/* Nút bị khoá không nhận chuột, nên tooltip gắn vào lớp bọc ngoài. */}
              <span className="ml-auto inline-flex" tabIndex={canUpload ? undefined : 0} data-testid="mission-upload-wrap">
                <Button
                  size="sm"
                  disabled={!canUpload}
                  onClick={() => startMissionUpload(home)}
                  data-testid="mission-upload"
                >
                  <CloudUpload aria-hidden />
                  NẠP MISSION
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-72">
              {canUpload ? (
                "Gửi mission xuống flight controller. Backend kiểm lại toàn bộ, nạp, rồi đọc ngược lên để so khớp. Chưa bay — BẮT ĐẦU AUTO là nút riêng (Phase 10)."
              ) : (
                <ul className="list-disc space-y-0.5 pl-4" data-testid="mission-lock-reasons">
                  {lockReasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </TooltipContent>
          </Tooltip>
        </div>
        {!canUpload ? (
          <p className="text-right text-[11px] text-muted-foreground" data-testid="mission-lock-summary">
            Chưa nạp được: {lockReasons[0]}
            {lockReasons.length > 1 ? ` (+${lockReasons.length - 1} lý do khác)` : ""}
          </p>
        ) : null}
      </div>
    </Panel>
  );
}
