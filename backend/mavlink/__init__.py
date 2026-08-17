"""Lớp MAVLink: connection, telemetry, control, mission, safety.

Phân chia trách nhiệm:

- `connection.py` mở link và chờ heartbeat.
- `telemetry.py` đọc và chuẩn hoá dữ liệu về JSON cho frontend.
- `control.py` gửi lệnh mức cao (mode, arm, takeoff, land, velocity).
- `mission.py` validate và upload waypoint theo MAVLink Mission Protocol.
- `safety.py` giữ state dead-man / quyền điều khiển của web.
"""
