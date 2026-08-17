"""Vision subsystem: stream, detector, events, recorder.

Luật cứng (SAFETY.md): vision KHÔNG BAO GIỜ điều khiển bay. Camera mất hoặc
process YOLO crash thì telemetry và control vẫn phải chạy, UAV không đổi mode.
"""
