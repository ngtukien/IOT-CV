"""Backend cho UAV Web GCS.

Kiến trúc bắt buộc (xem README GIAI ĐOẠN 0):

    Flight controller -> MAVLink -> backend -> normalized JSON -> frontend

Flight controller là thành phần DUY NHẤT chịu trách nhiệm ổn định máy bay.
Backend chỉ gửi lệnh mức cao và không bao giờ điều khiển motor trực tiếp.
"""

__version__ = "0.1.0"
