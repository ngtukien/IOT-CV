// Video từ ESP32-CAM (GIAI ĐOẠN 19, 69, 74) — chưa bật.
//
// Version 1: JPEG/MJPEG 640x480. Camera mất KHÔNG được ảnh hưởng telemetry hay
// control (GIAI ĐOẠN 78) — panel này chỉ hiển thị "CAMERA OFFLINE".

export function initVideo() {
  const panel = document.getElementById("video");
  if (panel) {
    panel.textContent = "CAMERA OFFLINE";
  }
}
