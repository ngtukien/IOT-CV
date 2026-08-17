#!/usr/bin/env python3
"""Tạo labels / milestones / issues trên GitHub cho repo này (GIAI ĐOẠN 2 và 89).

Script chỉ dùng stdlib — không cần cài thêm dependency. Nó idempotent: chạy lại
nhiều lần không tạo trùng, chỉ cập nhật màu/description khi khác.

Token đọc theo thứ tự:
  1. biến môi trường GITHUB_TOKEN hoặc GH_TOKEN
  2. `gh auth token` (nếu đã cài GitHub CLI)

Token cần scope `repo` (repo private) hoặc `public_repo` (repo public).

Ví dụ:
    python scripts/github/bootstrap_github.py --dry-run
    python scripts/github/bootstrap_github.py
    python scripts/github/bootstrap_github.py --issues 1-15
    python scripts/github/bootstrap_github.py --issues all
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

API_ROOT = "https://api.github.com"
REPO_ROOT = Path(__file__).resolve().parents[2]
README = REPO_ROOT / "README.md"

# ---------------------------------------------------------------------------
# Labels. Tên phải khớp với .github/ISSUE_TEMPLATE/*.yml và .github/dependabot.yml,
# và với commit prefix trong CONTRIBUTING.md.
# ---------------------------------------------------------------------------
LABELS: list[tuple[str, str, str]] = [
    # type/* — loại công việc, khớp commit prefix trong CONTRIBUTING.md
    ("type/feat", "1d76db", "Thêm chức năng (backend, frontend, ml, esp32)"),
    ("type/fix", "e99695", "PR sửa bug"),
    ("type/bug", "d73a4a", "Báo cáo bug"),
    ("type/test", "0e8a16", "Thêm/sửa test, flight test log"),
    ("type/docs", "0075ca", "Tài liệu, test log, kết quả experiment"),
    ("type/chore", "fef2c0", "Cấu hình, script, dependency"),
    ("type/ci", "bfd4f2", "GitHub Actions"),
    ("type/param", "5319e7", "Thay đổi parameter ArduPilot (kèm file params/)"),
    # area/* — vùng code bị ảnh hưởng
    ("area/backend", "c5def5", "FastAPI + MAVLink backend"),
    ("area/frontend", "c5def5", "Web GCS (telemetry, map, control)"),
    ("area/ml", "c5def5", "Dataset, training, YOLO"),
    ("area/esp32", "c5def5", "ESP32-CAM và MAVLink bridge"),
    ("area/flight", "c5def5", "Bay thật, flight log, calibration"),
    ("area/hardware", "c5def5", "Frame, motor, ESC, hệ thống nguồn"),
    ("area/infra", "c5def5", "CI, Makefile, cấu hình repo"),
    # safety/* — xem SAFETY.md
    ("safety/critical", "b60205", "Ảnh hưởng mode, failsafe, dead-man, geofence, motor output"),
    ("safety/reviewed", "0e8a16", "Phần safety đã được review"),
    # stage/* — SIMULATION -> BENCH -> GROUND -> FLIGHT (CONTRIBUTING.md)
    ("stage/sitl", "ededed", "Làm được hoàn toàn trên SITL"),
    ("stage/bench", "ededed", "Test trên bàn, props THÁO"),
    ("stage/ground", "ededed", "Test trên mặt đất, đã gắn props"),
    ("stage/flight", "ededed", "Cần bay thật"),
    # trạng thái
    ("blocked", "000000", "Chờ giai đoạn khác pass, hoặc chờ hardware về"),
]

# ---------------------------------------------------------------------------
# Milestones: nhóm 92 giai đoạn của README thành các mốc nghiệm thu.
# (title, (giai_đoạn_đầu, giai_đoạn_cuối), description)
# ---------------------------------------------------------------------------
MILESTONES: list[tuple[str, tuple[int, int], str]] = [
    ("M1 — Spec & môi trường", (1, 4), "Khoá spec, workspace, SITL, học ArduPilot trên drone ảo."),
    ("M2 — Backend MAVLink & web telemetry", (5, 8), "Backend đọc telemetry, web hiện số + map."),
    ("M3 — Manual control & dead-man safety", (9, 12), "WASD qua GUIDED, dead-man, HOLD/RTL/LAND."),
    ("M4 — Auto mission trên SITL", (13, 15), "Validate và upload mission, bay AUTO trên SITL."),
    ("M5 — Computer vision offline", (16, 23), "VisDrone, model A/B/C, degradation experiment."),
    ("M6 — Mua & lắp ráp hardware", (24, 31), "Test từng linh kiện, frame F450, nguồn, gắn FC."),
    ("M7 — Flash ArduPilot & calibration", (32, 44), "Frame type, RC, GPS/compass, accel, ESC."),
    ("M8 — Pre-arm & failsafe", (45, 49), "Pre-arm check, failsafe RC/GCS/battery, gắn prop."),
    ("M9 — Bay thật bằng RC", (50, 55), "First hop, AltHold, Loiter, RTL, AUTO qua MP."),
    ("M10 — ESP32 bridge & web bay thật", (56, 65), "MAVLink bridge, web mission/manual."),
    ("M11 — Camera on-board & dataset thật", (66, 73), "Mount, CoG, hover test, fine-tune."),
    ("M12 — YOLO + MQTT + dashboard", (74, 77), "Tích hợp detection vào web, chống spam, MQTT."),
    ("M13 — Failure test & geofence", (78, 84), "Mất camera/YOLO/web/RC, geofence, test matrix."),
    ("M14 — Experiment, log & tổng kết", (85, 92), "Experiment 2 môn, log, versioning, v2."),
]

PHASE_RE = re.compile(r"^# GIAI ĐOẠN (\d+) — (.+?)\s*$", re.MULTILINE)


class GitHubError(RuntimeError):
    """Lỗi trả về từ GitHub API."""


# ---------------------------------------------------------------------------
# Hạ tầng: token, repo slug, HTTP
# ---------------------------------------------------------------------------
def resolve_token() -> str:
    for env_name in ("GITHUB_TOKEN", "GH_TOKEN"):
        token = os.environ.get(env_name, "").strip()
        if token:
            return token
    try:
        out = subprocess.run(
            ["gh", "auth", "token"],
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        out = None
    if out is not None and out.returncode == 0 and out.stdout.strip():
        return out.stdout.strip()
    sys.exit(
        "Không tìm thấy GitHub token.\n"
        "  Cách 1: export GITHUB_TOKEN=<personal access token có scope repo>\n"
        "  Cách 2: cài GitHub CLI rồi chạy `gh auth login`\n"
        "  Tạo token: https://github.com/settings/tokens"
    )


def resolve_repo() -> str:
    out = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "remote", "get-url", "origin"],
        capture_output=True,
        text=True,
        check=False,
    )
    if out.returncode != 0:
        sys.exit("Không đọc được remote `origin`. Truyền --repo owner/name.")
    url = out.stdout.strip()
    match = re.search(r"github\.com[:/](?P<owner>[^/]+)/(?P<name>[^/]+?)(?:\.git)?$", url)
    if not match:
        sys.exit(f"Remote không phải GitHub: {url}. Truyền --repo owner/name.")
    return f"{match['owner']}/{match['name']}"


def api(
    token: str,
    method: str,
    path: str,
    payload: dict | None = None,
) -> dict | list:
    url = path if path.startswith("http") else f"{API_ROOT}{path}"
    data = json.dumps(payload).encode() if payload is not None else None
    request = urllib.request.Request(url, data=data, method=method)
    request.add_header("Accept", "application/vnd.github+json")
    request.add_header("Authorization", f"Bearer {token}")
    request.add_header("X-GitHub-Api-Version", "2022-11-28")
    request.add_header("User-Agent", "iot-cv-bootstrap")
    if data is not None:
        request.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode(errors="replace")
        raise GitHubError(f"{method} {url} -> HTTP {error.code}\n{detail}") from error
    except urllib.error.URLError as error:
        raise GitHubError(f"{method} {url} -> không kết nối được: {error.reason}") from error
    return json.loads(body) if body else {}


def api_list(token: str, path: str) -> list[dict]:
    """GET có phân trang, trả về toàn bộ item."""
    items: list[dict] = []
    page = 1
    separator = "&" if "?" in path else "?"
    while True:
        chunk = api(token, "GET", f"{path}{separator}per_page=100&page={page}")
        if not isinstance(chunk, list) or not chunk:
            break
        items.extend(chunk)
        if len(chunk) < 100:
            break
        page += 1
    return items


# ---------------------------------------------------------------------------
# Các bước bootstrap
# ---------------------------------------------------------------------------
def sync_labels(token: str, repo: str, dry_run: bool) -> None:
    existing = {item["name"]: item for item in api_list(token, f"/repos/{repo}/labels")}
    created = updated = 0
    for name, color, description in LABELS:
        current = existing.get(name)
        if current is None:
            print(f"  + label {name}")
            if not dry_run:
                api(
                    token,
                    "POST",
                    f"/repos/{repo}/labels",
                    {"name": name, "color": color, "description": description},
                )
            created += 1
            continue
        if current.get("color") == color and (current.get("description") or "") == description:
            continue
        print(f"  ~ label {name} (cập nhật màu/description)")
        if not dry_run:
            api(
                token,
                "PATCH",
                f"/repos/{repo}/labels/{urllib.parse.quote(name)}",
                {"new_name": name, "color": color, "description": description},
            )
        updated += 1
    print(f"  labels: {created} tạo mới, {updated} cập nhật, {len(LABELS)} tổng cộng")


def sync_milestones(token: str, repo: str, dry_run: bool) -> dict[str, int]:
    existing = {
        item["title"]: item for item in api_list(token, f"/repos/{repo}/milestones?state=all")
    }
    numbers: dict[str, int] = {}
    created = 0
    for title, (first, last), description in MILESTONES:
        full_description = f"{description} (GIAI ĐOẠN {first}–{last})"
        current = existing.get(title)
        if current is not None:
            numbers[title] = current["number"]
            if (current.get("description") or "") != full_description and not dry_run:
                api(
                    token,
                    "PATCH",
                    f"/repos/{repo}/milestones/{current['number']}",
                    {"description": full_description},
                )
            continue
        print(f"  + milestone {title}")
        created += 1
        if dry_run:
            continue
        result = api(
            token,
            "POST",
            f"/repos/{repo}/milestones",
            {"title": title, "description": full_description},
        )
        numbers[title] = result["number"]
    print(f"  milestones: {created} tạo mới, {len(MILESTONES)} tổng cộng")
    return numbers


def parse_phases() -> dict[int, str]:
    if not README.is_file():
        sys.exit(f"Không tìm thấy {README}")
    text = README.read_text(encoding="utf-8")
    return {int(number): title for number, title in PHASE_RE.findall(text)}


def parse_range(spec: str, available: list[int]) -> list[int]:
    if spec.strip().lower() == "all":
        return available
    wanted: set[int] = set()
    for part in spec.split(","):
        part = part.strip()
        if not part:
            continue
        if "-" in part:
            start, _, end = part.partition("-")
            try:
                wanted.update(range(int(start), int(end) + 1))
            except ValueError:
                sys.exit(f"Dải giai đoạn không hợp lệ: {part!r}")
        else:
            try:
                wanted.add(int(part))
            except ValueError:
                sys.exit(f"Số giai đoạn không hợp lệ: {part!r}")
    unknown = sorted(wanted - set(available))
    if unknown:
        sys.exit(f"README không có giai đoạn: {unknown}")
    return sorted(wanted)


def milestone_for_phase(phase: int) -> str | None:
    for title, (first, last), _ in MILESTONES:
        if first <= phase <= last:
            return title
    return None


def sync_issues(
    token: str,
    repo: str,
    spec: str,
    milestone_numbers: dict[str, int],
    dry_run: bool,
) -> None:
    phases = parse_phases()
    selected = parse_range(spec, sorted(phases))
    existing_titles = {
        item["title"]
        for item in api_list(token, f"/repos/{repo}/issues?state=all")
        if "pull_request" not in item
    }
    readme_url = f"https://github.com/{repo}/blob/main/README.md"
    created = skipped = 0
    for phase in selected:
        title = f"GĐ {phase} — {phases[phase]}"
        if title in existing_titles:
            skipped += 1
            continue
        milestone_title = milestone_for_phase(phase)
        body = (
            f"Giai đoạn **{phase}** trong kế hoạch 92 bước.\n\n"
            f"Mục tiêu, việc cần làm và **CỔNG PASS**: xem mục "
            f"`GIAI ĐOẠN {phase} — {phases[phase]}` trong [README.md]({readme_url}).\n\n"
            "- [ ] Đã đọc CỔNG PASS của giai đoạn trong README\n"
            "- [ ] `make lint` xanh\n"
            "- [ ] `make test` xanh\n"
            "- [ ] Đã ghi lại bằng chứng CỔNG PASS (output/ảnh/log) vào issue này\n"
        )
        payload: dict = {"title": title, "body": body, "labels": ["type/feat"]}
        if milestone_title in milestone_numbers:
            payload["milestone"] = milestone_numbers[milestone_title]
        print(f"  + issue {title}")
        created += 1
        if not dry_run:
            api(token, "POST", f"/repos/{repo}/issues", payload)
    print(f"  issues: {created} tạo mới, {skipped} đã có sẵn (bỏ qua)")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Tạo labels / milestones / issues trên GitHub cho repo IOT-CV.",
    )
    parser.add_argument("--repo", help="owner/name. Mặc định lấy từ remote origin.")
    parser.add_argument(
        "--issues",
        metavar="RANGE",
        help='Tạo issue cho các giai đoạn. Ví dụ: "1-15", "5,7,9", "all". '
        "Mặc định không tạo issue nào.",
    )
    parser.add_argument("--skip-labels", action="store_true", help="Không đồng bộ labels.")
    parser.add_argument("--skip-milestones", action="store_true", help="Không đồng bộ milestones.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Chỉ in ra những gì sẽ làm, không gọi API ghi.",
    )
    args = parser.parse_args()

    repo = args.repo or resolve_repo()
    token = resolve_token()
    prefix = "[dry-run] " if args.dry_run else ""
    print(f"{prefix}Repo: {repo}")

    try:
        if not args.skip_labels:
            print("Labels:")
            sync_labels(token, repo, args.dry_run)
        milestone_numbers: dict[str, int] = {}
        if not args.skip_milestones:
            print("Milestones:")
            milestone_numbers = sync_milestones(token, repo, args.dry_run)
        if args.issues:
            print("Issues:")
            sync_issues(token, repo, args.issues, milestone_numbers, args.dry_run)
    except GitHubError as error:
        print(f"\nLỗi GitHub API:\n{error}", file=sys.stderr)
        return 1

    print(f"\n{prefix}Xong.")
    if not args.issues:
        print("Chưa tạo issue nào — thêm --issues 1-15 nếu muốn tạo issue theo giai đoạn.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
