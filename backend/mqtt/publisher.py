"""Publish telemetry và detection event lên MQTT — GIAI ĐOẠN 76.

Pipeline môn IoT:

    Sensor / UAV -> Communication -> MQTT -> Processing -> Dashboard

TODO: implement connect/publish bằng paho-mqtt, có reconnect. MQTT mất kết nối
KHÔNG được làm ảnh hưởng telemetry hay control (xem SAFETY.md mục 9).
"""

from __future__ import annotations

import json
import logging

from backend import config

log = logging.getLogger(__name__)

TOPIC_TELEMETRY = "uav/telemetry"
TOPIC_STATUS = "uav/status"
TOPIC_MISSION = "uav/mission"
TOPIC_DETECTION_PERSON = "uav/detection/person"
TOPIC_LINK = "uav/link"

ALL_TOPICS = (
    TOPIC_TELEMETRY,
    TOPIC_STATUS,
    TOPIC_MISSION,
    TOPIC_DETECTION_PERSON,
    TOPIC_LINK,
)


class MqttPublisher:
    def __init__(self, broker: str | None = None, port: int | None = None) -> None:
        self.broker = broker or config.MQTT_BROKER
        self.port = config.MQTT_PORT if port is None else port
        self.client = None
        self.connected = False

    def connect(self) -> None:
        raise NotImplementedError("GIAI ĐOẠN 76: chưa implement MQTT connect")

    def publish(self, topic: str, payload: dict) -> None:
        """Publish JSON. Không raise khi broker chết — chỉ log."""
        if not self.connected:
            log.debug("MQTT chưa kết nối, bỏ qua publish %s", topic)
            return
        raise NotImplementedError("GIAI ĐOẠN 76: chưa implement MQTT publish")

    @staticmethod
    def encode(payload: dict) -> bytes:
        return json.dumps(payload, ensure_ascii=False).encode("utf-8")
