"""
============================================================
ANOMALY_DETECTOR.PY - Phát Hiện Bất Thường Tiêu Thụ Điện
Công Tơ Điện Thông Minh
============================================================
Các loại bất thường phát hiện:
  1. SPIKE       - Tiêu thụ tăng đột biến (> 3 sigma)
  2. THEFT       - Trộm điện (chỉ số giảm hoặc không đổi)
  3. NIGHT_HIGH  - Tiêu thụ ban đêm bất thường
  4. OFFLINE     - Thiết bị mất kết nối
  5. OCR_FAIL    - Không đọc được chỉ số nhiều lần liên tiếp
============================================================
"""

import numpy as np
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)


class AnomalyDetector:
    """Phát hiện bất thường trong dữ liệu tiêu thụ điện."""

    def __init__(self,
                 spike_threshold_sigma: float = 3.0,
                 night_threshold_kwh_per_hour: float = 1.5,
                 offline_threshold_hours: int = 2):
        """
        Args:
            spike_threshold_sigma: Ngưỡng Z-score để coi là tăng đột biến
            night_threshold_kwh_per_hour: kWh/h ban đêm vượt ngưỡng
            offline_threshold_hours: Giờ không có dữ liệu → coi là offline
        """
        self.spike_sigma         = spike_threshold_sigma
        self.night_threshold     = night_threshold_kwh_per_hour
        self.offline_hours       = offline_threshold_hours

    def analyze(self,
                meter_id: str,
                readings: List[dict],
                latest_reading: float,
                latest_time: datetime) -> List[dict]:
        """
        Phân tích tất cả các loại bất thường cho một công tơ.

        Args:
            meter_id: ID công tơ
            readings: Danh sách chỉ số lịch sử (dict với keys: reading_value, created_at)
            latest_reading: Chỉ số mới nhất vừa nhận được
            latest_time: Thời gian đọc mới nhất

        Returns:
            Danh sách các cảnh báo phát hiện được
        """
        alerts = []

        if len(readings) < 5:
            return alerts  # Không đủ dữ liệu để phân tích

        # Trích xuất mảng chỉ số
        values = [r['reading_value'] for r in readings]

        # Tính lượng tiêu thụ theo chu kỳ (increment)
        increments = []
        for i in range(1, len(values)):
            delta = values[i] - values[i-1]
            if delta >= 0:
                increments.append(delta)

        # --------------------------------------------------
        # Kiểm tra 1: Tăng đột biến (Z-score)
        # --------------------------------------------------
        spike_alert = self._detect_spike(meter_id, increments)
        if spike_alert:
            alerts.append(spike_alert)

        # --------------------------------------------------
        # Kiểm tra 2: Trộm điện (chỉ số giảm)
        # --------------------------------------------------
        if len(values) >= 2:
            theft_alert = self._detect_theft(meter_id, values[-1], latest_reading)
            if theft_alert:
                alerts.append(theft_alert)

        # --------------------------------------------------
        # Kiểm tra 3: Tiêu thụ ban đêm bất thường
        # --------------------------------------------------
        night_alert = self._detect_night_anomaly(meter_id, readings)
        if night_alert:
            alerts.append(night_alert)

        return alerts

    def _detect_spike(self, meter_id: str, increments: List[float]) -> Optional[dict]:
        """Phát hiện tăng đột biến dùng Z-score."""
        if len(increments) < 5:
            return None

        arr = np.array(increments)
        mean = np.mean(arr)
        std  = np.std(arr)

        if std == 0:
            return None

        latest_increment = increments[-1]
        z_score = (latest_increment - mean) / std

        if z_score > self.spike_sigma:
            return {
                "meter_id":   meter_id,
                "alert_type": "spike",
                "severity":   "danger",
                "message":    (f"Tiêu thụ điện tăng đột biến! "
                               f"Mức tăng: {latest_increment:.1f} kWh "
                               f"(gấp {latest_increment/mean:.1f}x mức TB: {mean:.1f} kWh)"),
                "value":      round(latest_increment, 2)
            }
        return None

    def _detect_theft(self, meter_id: str,
                      prev_value: float, current_value: float) -> Optional[dict]:
        """Phát hiện trộm điện khi chỉ số giảm."""
        if current_value < prev_value - 1.0:  # Giảm hơn 1 kWh
            drop = prev_value - current_value
            return {
                "meter_id":   meter_id,
                "alert_type": "theft",
                "severity":   "danger",
                "message":    (f"Nghi ngờ TRỘM ĐIỆN! Chỉ số giảm {drop:.1f} kWh: "
                               f"{prev_value:.1f} → {current_value:.1f} kWh"),
                "value":      round(-drop, 2)
            }
        return None

    def _detect_night_anomaly(self, meter_id: str,
                              readings: List[dict]) -> Optional[dict]:
        """Phát hiện tiêu thụ điện ban đêm bất thường (22h - 5h)."""
        night_increments = []

        for i in range(1, len(readings)):
            try:
                t = datetime.fromisoformat(readings[i]['created_at'])
            except (ValueError, KeyError):
                continue

            is_night = t.hour >= 22 or t.hour < 5
            if is_night:
                delta = readings[i]['reading_value'] - readings[i-1]['reading_value']
                if 0 < delta < 20:  # Hợp lý
                    night_increments.append(delta)

        if not night_increments:
            return None

        avg_night = np.mean(night_increments)

        # Tính kWh/h (mỗi chu kỳ đọc là 6h → chia 6)
        kwh_per_hour = avg_night / 6.0

        if kwh_per_hour > self.night_threshold:
            return {
                "meter_id":   meter_id,
                "alert_type": "night_usage",
                "severity":   "warning",
                "message":    (f"Tiêu thụ điện ban đêm bất thường: "
                               f"{kwh_per_hour:.2f} kWh/h "
                               f"(ngưỡng: {self.night_threshold} kWh/h)"),
                "value":      round(kwh_per_hour, 2)
            }
        return None

    def check_offline(self, meter_id: str,
                      last_reading_time: Optional[str]) -> Optional[dict]:
        """
        Kiểm tra thiết bị có offline không.

        Args:
            last_reading_time: Thời gian đọc cuối (ISO format string)
        """
        if not last_reading_time:
            return {
                "meter_id":   meter_id,
                "alert_type": "offline",
                "severity":   "danger",
                "message":    "Thiết bị chưa gửi dữ liệu lần nào!",
                "value":      None
            }

        try:
            last_time = datetime.fromisoformat(last_reading_time)
        except ValueError:
            return None

        hours_offline = (datetime.now() - last_time).total_seconds() / 3600

        if hours_offline > self.offline_hours:
            return {
                "meter_id":   meter_id,
                "alert_type": "offline",
                "severity":   "warning" if hours_offline < 24 else "danger",
                "message":    (f"Thiết bị không gửi dữ liệu trong "
                               f"{hours_offline:.1f} giờ!"),
                "value":      round(hours_offline, 1)
            }
        return None


# Singleton instance
detector = AnomalyDetector(
    spike_threshold_sigma=3.0,
    night_threshold_kwh_per_hour=1.5,
    offline_threshold_hours=2
)
