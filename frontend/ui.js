// Cập nhật DOM từ telemetry đã chuẩn hoá.

const EVENT_LOG_LIMIT = 50;

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function format(value, digits, suffix = "") {
  if (value === null || value === undefined) {
    return "-";
  }
  return `${Number(value).toFixed(digits)}${suffix}`;
}

export function renderTelemetry(state) {
  const dot = document.getElementById("link-dot");
  if (dot) {
    dot.className = `dot ${state.connected ? "online" : "offline"}`;
  }
  setText("link-text", state.connected ? "CONNECTED" : "DISCONNECTED");
  setText("endpoint", state.endpoint ?? "-");

  setText("mode", state.mode ?? "-");
  setText("armed", state.armed ? "YES" : "NO");
  setText("lat", format(state.lat, 7));
  setText("lon", format(state.lon, 7));
  setText("alt", format(state.relative_alt, 1, " m"));
  setText("heading", state.heading === null ? "-" : `${state.heading}°`);
  setText("speed", format(state.ground_speed, 1, " m/s"));
  setText("sats", state.satellites ?? "-");
  setText("battery", format(state.battery_voltage, 2, " V"));

  if (state.limits) {
    setText("max-velocity", state.limits.max_velocity);
  }
}

export function logEvent(message) {
  const list = document.getElementById("event-log");
  if (!list) {
    return;
  }
  const item = document.createElement("li");
  const now = new Date().toLocaleTimeString("vi-VN", { hour12: false });
  item.textContent = `${now} ${message}`;
  list.prepend(item);

  while (list.children.length > EVENT_LOG_LIMIT) {
    list.lastElementChild.remove();
  }
}
