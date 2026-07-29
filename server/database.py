"""
============================================================
DATABASE.PY - Quan ly SQLite Database
Cong To Dien Thong Minh
============================================================
"""

import sqlite3
import os
import sys
import logging
from datetime import datetime
from contextlib import contextmanager

# Fix Unicode encoding tren Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except AttributeError:
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

logger = logging.getLogger(__name__)

# Đường dẫn database
DB_PATH = os.path.join(os.path.dirname(__file__), "smart_meter.db")


@contextmanager
def get_db():
    """Context manager cho kết nối database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Trả về dict-like rows
    conn.execute("PRAGMA journal_mode=WAL")  # Tốt hơn cho concurrent access
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Khởi tạo database và tạo các bảng."""
    with get_db() as conn:
        conn.executescript("""
            -- Bảng công tơ điện
            CREATE TABLE IF NOT EXISTS meters (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                location    TEXT NOT NULL,
                address     TEXT,
                lat         REAL DEFAULT 10.7769,
                lng         REAL DEFAULT 106.7009,
                customer    TEXT,
                phone       TEXT,
                status      TEXT DEFAULT 'active',
                created_at  TEXT DEFAULT (datetime('now', 'localtime'))
            );

            -- Bảng chỉ số đọc được
            CREATE TABLE IF NOT EXISTS readings (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                meter_id        TEXT NOT NULL,
                reading_value   REAL NOT NULL,
                unit            TEXT DEFAULT 'kWh',
                image_path      TEXT,
                ocr_confidence  REAL DEFAULT 0.0,
                is_manual       INTEGER DEFAULT 0,
                rssi            INTEGER DEFAULT 0,
                created_at      TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (meter_id) REFERENCES meters(id)
            );

            -- Bảng cảnh báo
            CREATE TABLE IF NOT EXISTS alerts (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                meter_id    TEXT NOT NULL,
                alert_type  TEXT NOT NULL,
                severity    TEXT DEFAULT 'warning',
                message     TEXT NOT NULL,
                value       REAL,
                is_read     INTEGER DEFAULT 0,
                created_at  TEXT DEFAULT (datetime('now', 'localtime')),
                FOREIGN KEY (meter_id) REFERENCES meters(id)
            );

            -- Index để tăng tốc query
            CREATE INDEX IF NOT EXISTS idx_readings_meter_id ON readings(meter_id);
            CREATE INDEX IF NOT EXISTS idx_readings_created_at ON readings(created_at);
            CREATE INDEX IF NOT EXISTS idx_alerts_meter_id ON alerts(meter_id);
            CREATE INDEX IF NOT EXISTS idx_alerts_is_read ON alerts(is_read);
        """)

        # Chèn dữ liệu mẫu nếu chưa có
        existing = conn.execute("SELECT COUNT(*) FROM meters").fetchone()[0]
        if existing == 0:
            _insert_sample_data(conn)

    logger.info(f"[DB] Database initialized at: {DB_PATH}")


def _insert_sample_data(conn):
    """Chèn dữ liệu mẫu để demo."""
    import random
    from datetime import datetime, timedelta

    # Dữ liệu công tơ mẫu
    meters_data = [
        ("MTR-001", "Công tơ A-101", "Khu A, Phòng 101", "123 Nguyễn Văn Linh", 10.7769, 106.7009, "Nguyễn Văn An", "0901234567"),
        ("MTR-002", "Công tơ A-102", "Khu A, Phòng 102", "125 Nguyễn Văn Linh", 10.7772, 106.7012, "Trần Thị Bình", "0912345678"),
        ("MTR-003", "Công tơ B-201", "Khu B, Phòng 201", "45 Lê Lợi",           10.7758, 106.6995, "Lê Văn Cường", "0923456789"),
        ("MTR-004", "Công tơ B-202", "Khu B, Phòng 202", "47 Lê Lợi",           10.7755, 106.6998, "Phạm Thị Dung", "0934567890"),
        ("MTR-005", "Công tơ C-301", "Khu C, Phòng 301", "89 Đinh Tiên Hoàng",  10.7780, 106.7025, "Hoàng Văn Em", "0945678901"),
    ]

    conn.executemany("""
        INSERT INTO meters (id, name, location, address, lat, lng, customer, phone)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, meters_data)

    # Tạo lịch sử chỉ số (30 ngày qua)
    readings_data = []
    base_values = {"MTR-001": 1250.0, "MTR-002": 876.5, "MTR-003": 2103.2, "MTR-004": 445.8, "MTR-005": 1678.9}

    for meter_id, base_value in base_values.items():
        current_value = base_value
        for days_ago in range(30, -1, -1):
            for reading_num in range(4):  # 4 lần/ngày
                # Tăng ngẫu nhiên 0.5-3 kWh mỗi lần đọc
                increment = random.uniform(0.5, 3.0)
                current_value += increment

                # Thêm bất thường giả cho MTR-003 (ngày 15 trước)
                if meter_id == "MTR-003" and days_ago == 15 and reading_num == 2:
                    increment = random.uniform(8.0, 12.0)  # Tăng đột biến
                    current_value += increment

                reading_time = datetime.now() - timedelta(days=days_ago, hours=reading_num*6)
                readings_data.append((
                    meter_id,
                    round(current_value, 1),
                    None,
                    round(random.uniform(0.85, 0.99), 2),
                    reading_time.strftime("%Y-%m-%d %H:%M:%S")
                ))

    conn.executemany("""
        INSERT INTO readings (meter_id, reading_value, image_path, ocr_confidence, created_at)
        VALUES (?, ?, ?, ?, ?)
    """, readings_data)

    # Tạo cảnh báo mẫu
    alerts_data = [
        ("MTR-003", "spike",       "danger",  "Tiêu thụ điện tăng đột biến! Mức tăng: 10.5 kWh trong 6h", 10.5),
        ("MTR-001", "offline",     "warning", "Thiết bị không gửi dữ liệu trong 2 giờ",                    None),
        ("MTR-004", "night_usage", "warning", "Tiêu thụ điện ban đêm cao bất thường: 2.3 kWh/h",           2.3),
        ("MTR-002", "ocr_failed",  "info",    "OCR thất bại, cần kiểm tra camera",                         None),
        ("MTR-005", "theft",       "danger",  "Nghi ngờ trộm điện! Chỉ số giảm so với kỳ trước",           -5.2),
    ]

    conn.executemany("""
        INSERT INTO alerts (meter_id, alert_type, severity, message, value)
        VALUES (?, ?, ?, ?, ?)
    """, alerts_data)

    logger.info("[DB] Sample data inserted successfully")


def get_all_meters():
    """Lấy danh sách tất cả công tơ với chỉ số mới nhất."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT m.*,
                   r.reading_value as latest_reading,
                   r.created_at    as last_reading_time,
                   r.ocr_confidence,
                   r.image_path    as latest_image,
                   (SELECT COUNT(*) FROM alerts a WHERE a.meter_id = m.id AND a.is_read = 0) as unread_alerts
            FROM meters m
            LEFT JOIN readings r ON r.id = (
                SELECT id FROM readings WHERE meter_id = m.id ORDER BY created_at DESC LIMIT 1
            )
            ORDER BY m.id
        """).fetchall()
        return [dict(row) for row in rows]


def get_meter_readings(meter_id: str, limit: int = 100):
    """Lấy lịch sử chỉ số của một công tơ."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT * FROM readings
            WHERE meter_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (meter_id, limit)).fetchall()
        return [dict(row) for row in rows]


def get_unread_alerts(limit: int = 50):
    """Lấy danh sách cảnh báo chưa đọc."""
    with get_db() as conn:
        rows = conn.execute("""
            SELECT a.*, m.name as meter_name, m.location
            FROM alerts a
            JOIN meters m ON m.id = a.meter_id
            WHERE a.is_read = 0
            ORDER BY a.created_at DESC
            LIMIT ?
        """, (limit,)).fetchall()
        return [dict(row) for row in rows]


def save_reading(meter_id: str, value: float, image_path: str,
                 confidence: float, rssi: int = 0):
    """Lưu chỉ số mới vào database."""
    with get_db() as conn:
        conn.execute("""
            INSERT INTO readings (meter_id, reading_value, image_path, ocr_confidence, rssi)
            VALUES (?, ?, ?, ?, ?)
        """, (meter_id, value, image_path, confidence, rssi))


def save_alert(meter_id: str, alert_type: str, severity: str,
               message: str, value=None):
    """Lưu cảnh báo mới."""
    with get_db() as conn:
        conn.execute("""
            INSERT INTO alerts (meter_id, alert_type, severity, message, value)
            VALUES (?, ?, ?, ?, ?)
        """, (meter_id, alert_type, severity, message, value))


def get_dashboard_stats():
    """Lấy thống kê tổng quan cho dashboard."""
    with get_db() as conn:
        total_meters   = conn.execute("SELECT COUNT(*) FROM meters").fetchone()[0]
        total_readings = conn.execute("SELECT COUNT(*) FROM readings").fetchone()[0]
        unread_alerts  = conn.execute("SELECT COUNT(*) FROM alerts WHERE is_read = 0").fetchone()[0]

        # Tổng kWh hôm nay
        today_kwh = conn.execute("""
            SELECT COALESCE(SUM(reading_value - prev_value), 0)
            FROM (
                SELECT reading_value,
                       LAG(reading_value) OVER (PARTITION BY meter_id ORDER BY created_at) as prev_value
                FROM readings
                WHERE date(created_at) = date('now', 'localtime')
            ) WHERE prev_value IS NOT NULL AND reading_value > prev_value
        """).fetchone()[0]

        return {
            "total_meters":   total_meters,
            "total_readings": total_readings,
            "unread_alerts":  unread_alerts,
            "today_kwh":      round(today_kwh, 1),
        }
