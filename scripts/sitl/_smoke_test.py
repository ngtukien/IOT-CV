import sys
import time

sys.path.insert(0, "scripts/sitl")
import harness

with harness.SitlInstance("/tmp/sitl-smoke", speedup=8) as s:
    print("connected, target_system", s.master.target_system)
    print("mode ban dau:", s.get_mode_name())
    s.set_mode("GUIDED")
    print("mode sau set:", s.get_mode_name())

    print("--- doi EKF_STATUS_REPORT trong 20s ---")
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        msg = s.master.recv_match(
            type="EKF_STATUS_REPORT", blocking=True, timeout=deadline - time.monotonic()
        )
        if msg is not None:
            print(
                "EKF_STATUS_REPORT flags=",
                msg.flags,
                "velocity_variance=",
                msg.velocity_variance,
                "pos_horiz_variance=",
                msg.pos_horiz_variance,
            )

    print("--- thu arm ---")
    try:
        s.arm()
        print("armed ok")
    except harness.SitlError as e:
        print("arm loi:", e)
        print("--- doi them 5s xem co STATUSTEXT nao khac khong ---")
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            msg = s.master.recv_match(
                type="STATUSTEXT", blocking=True, timeout=deadline - time.monotonic()
            )
            if msg is not None:
                print("STATUSTEXT(sau):", msg.severity, msg.text)
        raise
    print("mode truoc takeoff:", s.get_mode_name())
    hb = s.master.messages.get("HEARTBEAT")
    print("armed truoc takeoff:", bool(hb.base_mode & 128) if hb else "khong ro")
    try:
        s.takeoff(10)
    except harness.SitlError as e:
        print("takeoff loi:", e)
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            msg = s.master.recv_match(
                type="STATUSTEXT", blocking=True, timeout=deadline - time.monotonic()
            )
            if msg is not None:
                print("STATUSTEXT(takeoff sau loi):", msg.severity, msg.text)
        raise
    pos = s.get_position()
    print("vi tri sau takeoff:", pos)
    s.set_mode("RTL")
    s.wait_disarmed(timeout=90)
    print("disarmed sau RTL, OK")
print("--- stop() da chay ---")
