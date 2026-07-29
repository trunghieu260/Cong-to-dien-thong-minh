"""
============================================================
APP.PY - Flask API Server
Công Tơ Điện Thông Minh
============================================================
Endpoints:
  POST /api/upload          - Nhận ảnh từ ESP32-CAM
  GET  /api/meters          - Danh sách công tơ
  GET  /api/meters/<id>     - Chi tiết 1 công tơ
  GET  /api/readings/<id>   - Lịch sử chỉ số
  GET  /api/alerts          - Danh sách cảnh báo
  GET  /api/stats           - Thống kê tổng quan
  POST /api/alerts/<id>/read - Đánh dấu đã đọc cảnh báo
============================================================
Chạy: python app.py
      Server tại: http://localhost:5000
============================================================
"""

import os
import sys
import logging
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory, redirect
from flask_cors import CORS

# Fix Unicode encoding tren Windows
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except AttributeError:
        pass

import database as db
from ocr_processor import process_meter_image
from anomaly_detector import detector

# ============================================================
# KHỞI TẠO
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger(__name__)

DASHBOARD_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "dashboard"))
app = Flask(__name__, static_folder=DASHBOARD_DIR, static_url_path="")
CORS(app)  # Cho phép Dashboard từ mọi origin

# Thư mục lưu ảnh chụp
IMAGES_DIR = os.path.join(os.path.dirname(__file__), "images")
os.makedirs(IMAGES_DIR, exist_ok=True)

# Khởi tạo DB khi start
db.init_db()

# ============================================================
# ENDPOINT: Nhận ảnh từ ESP32-CAM
# ============================================================
@app.route("/api/upload", methods=["POST"])
def upload_image():
    """
    Nhận ảnh JPEG từ ESP32-CAM, chạy OCR, lưu kết quả.

    Headers:
        X-Meter-ID:      ID công tơ
        X-Device-Token:  Token xác thực
        X-RSSI:          Cường độ WiFi
    Body:
        Raw JPEG bytes
    """
    # Xác thực token (đơn giản, production cần JWT)
    token    = request.headers.get("X-Device-Token", "")
    meter_id = request.headers.get("X-Meter-ID", "UNKNOWN")
    rssi     = int(request.headers.get("X-RSSI", "0"))

    logger.info(f"[UPLOAD] Nhận ảnh từ {meter_id} (RSSI: {rssi} dBm)")

    # Đọc dữ liệu ảnh
    image_bytes = request.data
    if not image_bytes:
        return jsonify({"error": "Không có dữ liệu ảnh"}), 400

    # Lấy chỉ số lần trước
    prev_readings = db.get_meter_readings(meter_id, limit=5)
    prev_value    = prev_readings[0]["reading_value"] if prev_readings else None

    # Lưu ảnh vào disk
    img_filename = f"{meter_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.jpg"
    img_path     = os.path.join(IMAGES_DIR, img_filename)
    with open(img_path, "wb") as f:
        f.write(image_bytes)

    # Chạy OCR
    ocr_result = process_meter_image(image_bytes, prev_value)

    response_data = {
        "meter_id":    meter_id,
        "image_saved": img_filename,
        "ocr_success": ocr_result["success"],
        "ocr_method":  ocr_result.get("method"),
        "raw_text":    ocr_result["raw_text"],
        "confidence":  ocr_result["confidence"],
    }

    if ocr_result["success"]:
        reading_value = ocr_result["reading_value"]
        response_data["reading_value"] = reading_value

        # Lưu chỉ số vào DB
        db.save_reading(
            meter_id=meter_id,
            value=reading_value,
            image_path=img_filename,
            confidence=ocr_result["confidence"],
            rssi=rssi
        )

        # Phát hiện bất thường
        all_readings = db.get_meter_readings(meter_id, limit=50)
        alerts = detector.analyze(
            meter_id=meter_id,
            readings=all_readings,
            latest_reading=reading_value,
            latest_time=datetime.now()
        )

        for alert in alerts:
            db.save_alert(**alert)
            logger.warning(f"[ALERT] {meter_id}: {alert['message']}")

        response_data["alerts_triggered"] = len(alerts)
        logger.info(f"[OCR] {meter_id}: {reading_value} kWh (conf: {ocr_result['confidence']:.1%})")

    else:
        # OCR thất bại → lưu cảnh báo
        db.save_alert(
            meter_id=meter_id,
            alert_type="ocr_failed",
            severity="info",
            message=f"OCR thất bại: {ocr_result.get('error', 'Lỗi không xác định')}",
            value=None
        )
        response_data["error"] = ocr_result.get("error")
        logger.warning(f"[OCR] {meter_id}: Thất bại - {ocr_result.get('error')}")

    return jsonify(response_data), 200 if ocr_result["success"] else 422


# ============================================================
# ENDPOINT: Danh sách công tơ
# ============================================================
@app.route("/api/meters", methods=["GET"])
def get_meters():
    """Trả về danh sách tất cả công tơ với chỉ số mới nhất."""
    meters = db.get_all_meters()
    return jsonify({"meters": meters, "count": len(meters)})


@app.route("/api/meters/<meter_id>", methods=["GET"])
def get_meter_detail(meter_id: str):
    """Trả về chi tiết một công tơ."""
    meters   = db.get_all_meters()
    meter    = next((m for m in meters if m["id"] == meter_id), None)
    if not meter:
        return jsonify({"error": "Không tìm thấy công tơ"}), 404

    readings = db.get_meter_readings(meter_id, limit=200)
    meter["readings"] = readings
    return jsonify(meter)


# ============================================================
# ENDPOINT: Lịch sử chỉ số
# ============================================================
@app.route("/api/readings/<meter_id>", methods=["GET"])
def get_readings(meter_id: str):
    """Trả về lịch sử chỉ số của một công tơ."""
    limit    = min(int(request.args.get("limit", 100)), 1000)
    readings = db.get_meter_readings(meter_id, limit=limit)
    return jsonify({"meter_id": meter_id, "readings": readings, "count": len(readings)})


# ============================================================
# ENDPOINT: Cảnh báo
# ============================================================
@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    """Trả về danh sách cảnh báo chưa đọc."""
    limit  = min(int(request.args.get("limit", 50)), 200)
    alerts = db.get_unread_alerts(limit=limit)
    return jsonify({"alerts": alerts, "count": len(alerts)})


@app.route("/api/alerts/<int:alert_id>/read", methods=["POST"])
def mark_alert_read(alert_id: int):
    """Đánh dấu cảnh báo là đã đọc."""
    with db.get_db() as conn:
        conn.execute("UPDATE alerts SET is_read = 1 WHERE id = ?", (alert_id,))
    return jsonify({"success": True, "alert_id": alert_id})


# ============================================================
# ENDPOINT: Thống kê Dashboard
# ============================================================
@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Trả về thống kê tổng quan."""
    stats = db.get_dashboard_stats()
    return jsonify(stats)


# ============================================================
# ENDPOINT: Xem ảnh đã chụp
# ============================================================
@app.route("/api/images/<filename>", methods=["GET"])
def get_image(filename: str):
    """Trả về ảnh đã chụp từ ESP32-CAM."""
    return send_from_directory(IMAGES_DIR, filename)


# ============================================================
# HEALTH CHECK
# ============================================================
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status":    "ok",
        "service":   "Smart Meter OCR Server",
        "version":   "1.0.0",
        "timestamp": datetime.now().isoformat()
    })


# ============================================================
# DASHBOARD / STATIC FILES
# ============================================================
@app.route("/")
def home():
    return redirect("/index.html")

@app.route("/<path:filename>")
def dashboard_files(filename):
    return send_from_directory(DASHBOARD_DIR, filename)


# ============================================================
# MAIN
# ============================================================
if __name__ == "__main__":
    print("=" * 55)
    print("  CÔNG TƠ ĐIỆN THÔNG MINH - OCR Server v1.0.0")
    print("=" * 55)
    print(f"  Server: http://0.0.0.0:5000")
    print(f"  Images: {IMAGES_DIR}")
    print(f"  Dashboard: {DASHBOARD_DIR}")
    print("=" * 55)
    app.run(host="0.0.0.0", port=5000, debug=True)
