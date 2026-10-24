"""`MavlinkConnection.connect()` phải chốt sysid của FLIGHT CONTROLLER.

Drone thật qua ESP32 DroneBridge (25/10/2026): cổng UDP 14550 nhận heartbeat của GCS
(255,0) và của chính DroneBridge (255,68) TRƯỚC heartbeat của FC (1,1). Bản cũ chốt
sysid 0 rồi lọc bỏ mọi gói của FC.
"""

from __future__ import annotations

import pytest
from pymavlink import mavutil

from backend.mavlink.connection import MavlinkConnection
from backend.tests.fakes import FakeMAVLink, FakeMessage

MAV = mavutil.mavlink


class _Heartbeat(FakeMessage):
    """FakeMessage có nguồn: `FakeMessage` thường cố ý không có get_srcSystem."""

    def __init__(self, src: tuple[int, int], *, mav_type: int, autopilot: int) -> None:
        super().__init__(
            "HEARTBEAT", type=mav_type, autopilot=autopilot, base_mode=0, custom_mode=0
        )
        self._src = src

    def get_srcSystem(self) -> int:
        return self._src[0]

    def get_srcComponent(self) -> int:
        return self._src[1]


GCS = _Heartbeat((255, 0), mav_type=MAV.MAV_TYPE_GCS, autopilot=MAV.MAV_AUTOPILOT_INVALID)
DRONEBRIDGE = _Heartbeat(
    (255, 68), mav_type=MAV.MAV_TYPE_ONBOARD_CONTROLLER, autopilot=MAV.MAV_AUTOPILOT_INVALID
)
FC = _Heartbeat((1, 1), mav_type=MAV.MAV_TYPE_QUADROTOR, autopilot=MAV.MAV_AUTOPILOT_ARDUPILOTMEGA)


def _master(monkeypatch, queue: list) -> FakeMAVLink:
    fake = FakeMAVLink(queue)
    fake.target_system = fake.target_component = 0  # như pymavlink khi chưa thấy máy bay
    monkeypatch.setattr(mavutil, "mavlink_connection", lambda *a, **k: fake)
    return fake


def test_bo_qua_heartbeat_gcs_va_dronebridge_chot_sysid_cua_fc(monkeypatch):
    fake = _master(monkeypatch, [GCS, DRONEBRIDGE, FC])
    conn = MavlinkConnection("udpin:0.0.0.0:14550")

    assert conn.connect(timeout=1) == (1, 1)
    assert (conn.target_system, conn.target_component) == (1, 1)
    assert (fake.target_system, fake.target_component) == (1, 1)


def test_chi_co_heartbeat_khong_phai_may_bay_thi_het_gio_va_dong_cong(monkeypatch):
    fake = _master(monkeypatch, [GCS, DRONEBRIDGE])
    conn = MavlinkConnection("udpin:0.0.0.0:14550")

    with pytest.raises(TimeoutError, match="flight controller"):
        conn.connect(timeout=1)
    assert fake.closed
    assert conn.target_system is None
