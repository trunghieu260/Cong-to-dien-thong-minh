<div align="center">

# ⚡ Công Tơ Điện Thông Minh
### Smart Electric Meter with ESP32-CAM & AI OCR

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.0-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![EasyOCR](https://img.shields.io/badge/EasyOCR-1.7.1-FF6B6B?style=flat-square)](https://github.com/JaidedAI/EasyOCR)
[![ESP32](https://img.shields.io/badge/ESP32--CAM-AI%20Thinker-E7352C?style=flat-square&logo=espressif&logoColor=white)](https://www.espressif.com)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**Hệ thống đọc và giám sát chỉ số công tơ điện tự động sử dụng ESP32-CAM + Computer Vision + OCR AI**

[Demo Dashboard](#-dashboard-preview) · [Cài đặt nhanh](#-cài-đặt-nhanh) · [API Docs](#-api-endpoints) · [Firmware](#-cài-đặt-firmware)

</div>

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Tính năng](#-tính-năng)
- [Công nghệ sử dụng](#-công-nghệ-sử-dụng)
- [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
- [Cài đặt nhanh](#-cài-đặt-nhanh)
- [Cài đặt Firmware ESP32-CAM](#-cài-đặt-firmware)
- [API Endpoints](#-api-endpoints)
- [Quy trình OCR](#-quy-trình-ocr)
- [Phát hiện bất thường](#-phát-hiện-bất-thường)
- [Đóng góp](#-đóng-góp)

---

## 🔍 Giới thiệu

**Công Tơ Điện Thông Minh** là hệ thống IoT hoàn chỉnh giúp **tự động hóa việc đọc chỉ số điện** mà không cần nhân viên đến tận nơi. ESP32-CAM chụp ảnh màn hình công tơ định kỳ, gửi lên server Flask qua WiFi. Server xử lý ảnh bằng AI (EasyOCR + OpenCV), trích xuất số liệu, lưu vào cơ sở dữ liệu và cảnh báo khi phát hiện bất thường.

### Vấn đề giải quyết

| Vấn đề truyền thống | Giải pháp của hệ thống |
|---|---|
| 🚶 Nhân viên đọc số thủ công mỗi tháng | 🤖 Tự động chụp và đọc số mỗi 5 phút |
| ❌ Sai sót do nhập liệu tay | ✅ OCR AI độ chính xác >95% |
| 📵 Không phát hiện trộm điện kịp thời | 🚨 Cảnh báo tức thì khi phát hiện bất thường |
| 📊 Không có dữ liệu lịch sử chi tiết | 📈 Lưu toàn bộ lịch sử, phân tích xu hướng |

---

## 🏗️ Kiến trúc hệ thống

```
┌─────────────────────────────────────────────────────────────┐
│                      HỆ THỐNG TỔNG QUAN                    │
│                                                             │
│   ┌──────────────┐    WiFi/HTTP    ┌─────────────────────┐  │
│   │  ESP32-CAM   │ ─────────────► │   Flask API Server  │  │
│   │              │  POST /upload   │   (Python 3.10)     │  │
│   │  - Chụp ảnh  │  Raw JPEG data │   port: 5000        │  │
│   │  - Flash LED │                │                     │  │
│   │  - Web UI    │                │  ┌───────────────┐  │  │
│   └──────────────┘                │  │  OCR Pipeline │  │  │
│                                   │  │  OpenCV →     │  │  │
│   ┌──────────────┐                │  │  EasyOCR →    │  │  │
│   │   Dashboard  │ ◄────────────  │  │  Validate     │  │  │
│   │   (HTML/JS)  │  REST API JSON │  └───────────────┘  │  │
│   │              │                │                     │  │
│   │  - Bản đồ   │                │  ┌───────────────┐  │  │
│   │  - Biểu đồ │                │  │  SQLite DB    │  │  │
│   │  - Cảnh báo│                │  │  - meters     │  │  │
│   │  - Tính tiền│                │  │  - readings   │  │  │
│   └──────────────┘                │  │  - alerts     │  │  │
│                                   │  └───────────────┘  │  │
│                                   └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✨ Tính năng

### 📷 Phần cứng (ESP32-CAM)
- Chụp ảnh định kỳ (mặc định 5 giây/lần)
- Flash LED tự động khi chụp tối
- Web server nội bộ xem ảnh live trực tiếp trên trình duyệt
- Tự kết nối lại WiFi khi mất tín hiệu
- Gửi kèm thông tin RSSI (cường độ WiFi)

### 🧠 Xử lý AI (Python Server)
- **Tiền xử lý ảnh**: Grayscale → CLAHE → Gaussian Blur → Adaptive Threshold → Morphological ops
- **Phát hiện vùng màn hình**: Tự động cắt vùng LCD công tơ bằng Canny + Contour detection
- **OCR kép**: EasyOCR (primary) → Tesseract (fallback nếu confidence < 50%)
- **Validation**: Kiểm tra khoảng hợp lệ (0–999,999 kWh), so sánh chỉ số cũ

### 🚨 Phát hiện bất thường
- ⚡ **Spike**: Tiêu thụ tăng đột biến (>3x mức trung bình)
- 🔓 **Theft**: Chỉ số điện giảm bất thường (nghi trộm điện)
- 📡 **Offline**: Thiết bị không gửi dữ liệu quá 2 giờ
- 🌙 **Night Usage**: Dùng điện ban đêm cao bất thường

### 📊 Dashboard Web
- **Tổng quan**: Stats card, biểu đồ tiêu thụ 7 ngày, danh sách công tơ
- **Bản đồ**: Leaflet.js với marker theo trạng thái (active/warning/danger/offline)
- **Biểu đồ**: Chart.js - phân tích theo giờ, tháng, timeline 30 ngày
- **Ảnh công tơ**: Gallery ảnh chụp từ ESP32-CAM, hỗ trợ upload manual để test OCR
- **Cảnh báo**: Realtime alerts, lọc theo mức độ, đánh dấu đã xử lý
- **Tính tiền**: Tính tiền điện theo bậc thang EVN (6 bậc)

---

## 🔧 Công nghệ sử dụng

| Lớp | Công nghệ | Phiên bản |
|---|---|---|
| **Firmware** | Arduino C++ (ESP32) | ESP-IDF 5.x |
| **Backend** | Python + Flask | 3.10 / 3.0.0 |
| **Computer Vision** | OpenCV | 4.9.0 |
| **OCR** | EasyOCR + Tesseract | 1.7.1 |
| **Database** | SQLite (WAL mode) | 3.x |
| **Frontend** | HTML5 + Vanilla JS | ES2022 |
| **Charts** | Chart.js | 4.x (CDN) |
| **Map** | Leaflet.js | 1.9 (CDN) |
| **Icons** | Lucide Icons | Latest (CDN) |

---

## 📁 Cấu trúc thư mục

```
cong-to-dien-thong-minh/
│
├── 📂 firmware/                    # Code ESP32-CAM (Arduino)
│   ├── esp32cam_meter_reader.ino   # Firmware chính
│   └── config.h                    # Cấu hình WiFi, Server, Camera
│
├── 📂 server/                      # Backend Python Flask
│   ├── app.py                      # Flask API server (entry point)
│   ├── ocr_processor.py            # Pipeline xử lý ảnh & OCR
│   ├── anomaly_detector.py         # Phát hiện bất thường
│   ├── database.py                 # SQLite ORM & queries
│   ├── requirements.txt            # Python dependencies
│   ├── run_server.bat              # 🚀 Script khởi động (Windows)
│   ├── smart_meter.db              # SQLite database (auto-created)
│   └── 📂 images/                  # Ảnh chụp từ ESP32-CAM
│
├── 📂 dashboard/                   # Frontend Web
│   ├── index.html                  # Giao diện chính
│   ├── app.js                      # Logic JavaScript
│   └── style.css                   # Styling (Dark theme)
│
└── README.md
```

---

## 🚀 Cài đặt nhanh

### Yêu cầu hệ thống
- Python 3.10+
- ESP32-CAM (AI Thinker module)
- Arduino IDE 2.x với ESP32 board support
- Tesseract OCR (tùy chọn - chỉ cần nếu EasyOCR không đủ)

### 1. Clone repository

```bash
git clone https://github.com/<your-username>/cong-to-dien-thong-minh.git
cd cong-to-dien-thong-minh
```

### 2. Cài đặt Python dependencies

```bash
cd server
pip install -r requirements.txt
```

> **Lưu ý**: Lần đầu chạy EasyOCR sẽ tự động download model (~200MB). Cần kết nối internet.

### 3. Khởi động server

**Windows** (khuyến nghị - tránh lỗi Unicode):
```batch
cd server
run_server.bat
```

**Linux / macOS**:
```bash
cd server
PYTHONUTF8=1 python app.py
```

**PowerShell**:
```powershell
$env:PYTHONUTF8="1"
python app.py
```

Server khởi động tại: **http://localhost:5000**

### 4. Truy cập Dashboard

Mở trình duyệt và vào: [http://localhost:5000](http://localhost:5000)

Dashboard sẽ tự động load dữ liệu mẫu (5 công tơ, 30 ngày lịch sử đầy đủ).

---

## 📡 Cài đặt Firmware

### Cấu hình trước khi nạp

Mở file `firmware/esp32cam_meter_reader.ino` và chỉnh các thông số:

```cpp
// WiFi
#define WIFI_SSID       "TEN_WIFI_CUA_BAN"
#define WIFI_PASSWORD   "MAT_KHAU_WIFI"

// Server (IP máy tính chạy Flask)
#define SERVER_HOST     "192.168.x.x"
#define SERVER_PORT     5000

// ID định danh công tơ này
#define METER_ID        "MTR-001"
#define DEVICE_TOKEN    "esp32cam-secret-token"
```

### Cài đặt Arduino IDE

1. Thêm ESP32 board vào Arduino IDE:
   - **File → Preferences → Additional Board Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
2. **Tools → Board → ESP32 Arduino → AI Thinker ESP32-CAM**
3. **Tools → Port** → chọn COM port của ESP32
4. Upload code

### Sơ đồ kết nối nạp code

| ESP32-CAM | FTDI Adapter |
|---|---|
| GND | GND |
| 5V | VCC |
| U0T (TX) | RX |
| U0R (RX) | TX |
| GPIO0 | GND (chỉ khi nạp) |

> ⚠️ **Quan trọng**: Nối GPIO0 với GND trước khi cấp nguồn để vào boot mode. Tháo dây sau khi nạp xong và reset.

---

## 📡 API Endpoints

| Method | Endpoint | Mô tả |
|---|---|---|
| `POST` | `/api/upload` | Nhận ảnh JPEG từ ESP32-CAM, chạy OCR |
| `GET` | `/api/meters` | Danh sách tất cả công tơ + chỉ số mới nhất |
| `GET` | `/api/meters/<id>` | Chi tiết 1 công tơ + lịch sử readings |
| `GET` | `/api/readings/<id>` | Lịch sử chỉ số (query: `?limit=100`) |
| `GET` | `/api/alerts` | Danh sách cảnh báo chưa đọc |
| `POST` | `/api/alerts/<id>/read` | Đánh dấu cảnh báo đã xử lý |
| `GET` | `/api/stats` | Thống kê tổng quan dashboard |
| `GET` | `/api/images/<filename>` | Xem ảnh chụp từ ESP32-CAM |
| `GET` | `/api/health` | Health check server |

### Ví dụ: Upload ảnh (ESP32 → Server)

```http
POST /api/upload HTTP/1.1
Content-Type: image/jpeg
X-Meter-ID: MTR-001
X-Device-Token: esp32cam-secret-token
X-RSSI: -65

<raw JPEG bytes>
```

**Response 200 (OCR thành công)**:
```json
{
  "meter_id": "MTR-001",
  "ocr_success": true,
  "reading_value": 1487.3,
  "confidence": 0.9963,
  "ocr_method": "easyocr",
  "raw_text": "14873",
  "image_saved": "MTR-001_20260730_051705_860d13e2.jpg",
  "alerts_triggered": 0
}
```

**Response 422 (OCR thất bại)**:
```json
{
  "meter_id": "MTR-001",
  "ocr_success": false,
  "error": "Không thể parse giá trị từ: ''",
  "image_saved": "MTR-001_20260730_051800_abc123.jpg"
}
```

### Ví dụ: Upload manual từ cURL

```bash
curl -X POST http://localhost:5000/api/upload \
  -H "Content-Type: image/jpeg" \
  -H "X-Meter-ID: MTR-001" \
  -H "X-Device-Token: dashboard" \
  -H "X-RSSI: 0" \
  --data-binary @anh_cong_to.jpg
```

---

## 🔬 Quy trình OCR

```
Ảnh JPEG (ESP32-CAM)
        │
        ▼
┌───────────────────────────┐
│     Tiền xử lý ảnh        │
│  1. Grayscale             │
│  2. CLAHE                 │  ← Tăng tương phản (clipLimit=3.0)
│  3. Gaussian Blur (3×3)   │  ← Giảm nhiễu
│  4. Adaptive Threshold    │  ← Xử lý ánh sáng không đều
│  5. Morphological Close   │  ← Làm sạch pixel lỗi
└────────────┬──────────────┘
             │
             ▼
┌───────────────────────────┐
│   Phát hiện vùng màn hình │
│  Canny Edge Detection     │
│  Contour Finding          │  ← Tìm hình chữ nhật ratio 1.5–6.0
│  Crop vùng LCD            │
└────────────┬──────────────┘
             │
    ┌────────┴────────┐
    ▼                 ▼
┌──────────┐    ┌──────────────────┐
│ EasyOCR  │    │ Tesseract (dự    │
│ primary  │───►│ phòng nếu conf   │
│ conf>50% │    │ < 50%)           │
└──────────┘    └──────────────────┘
             │
             ▼
   ┌─────────────────────────┐
   │       Validation        │
   │  0 ≤ value ≤ 999,999    │
   │  So sánh chỉ số trước   │
   │  Trigger cảnh báo       │
   └─────────────────────────┘
```

---

## 🚨 Phát hiện bất thường

| Loại | Điều kiện kích hoạt | Mức độ |
|---|---|---|
| `spike` | Mức tiêu thụ > 3× mức trung bình | 🔴 Danger |
| `theft` | Chỉ số giảm > 0.5 kWh so với lần trước | 🔴 Danger |
| `offline` | Không có reading mới trong 2 giờ | 🟡 Warning |
| `night_usage` | Dùng điện ban đêm > 1.5 kWh/h (22h–6h) | 🟡 Warning |
| `ocr_failed` | OCR không đọc được chỉ số | 🔵 Info |

---

## 💡 Tính tiền điện (Biểu giá EVN 2024)

| Bậc | Lượng điện | Đơn giá |
|---|---|---|
| Bậc 1 | 0 – 50 kWh | 1.806 đ/kWh |
| Bậc 2 | 51 – 100 kWh | 1.866 đ/kWh |
| Bậc 3 | 101 – 200 kWh | 2.167 đ/kWh |
| Bậc 4 | 201 – 300 kWh | 2.729 đ/kWh |
| Bậc 5 | 301 – 400 kWh | 3.050 đ/kWh |
| Bậc 6 | Trên 400 kWh | 3.151 đ/kWh |

> VAT 10% được tính thêm vào tổng tiền.

---

## 🖥️ Dashboard Preview

| Trang | Mô tả |
|---|---|
| **Tổng quan** | Stat cards, biểu đồ tiêu thụ 7 ngày, bảng công tơ gần đây |
| **Danh sách công tơ** | Grid card với tín hiệu WiFi, trạng thái, tìm kiếm/lọc |
| **Bản đồ** | Leaflet.js dark map với marker màu theo trạng thái |
| **Biểu đồ** | Phân tích theo giờ (bar), so sánh tháng, timeline 30 ngày |
| **Ảnh công tơ** | Gallery + upload ảnh manual để test OCR |
| **Cảnh báo** | Danh sách realtime, lọc theo mức độ |
| **Tính tiền** | Tính hóa đơn theo bậc thang EVN |
| **Cài đặt** | Cấu hình server URL, chu kỳ refresh |

---

## ⚙️ Cấu hình nâng cao

### Thay đổi chu kỳ chụp ảnh (Firmware)

```cpp
// Trong esp32cam_meter_reader.ino
#define CAPTURE_INTERVAL_MS 5000   // 5 giây (mặc định)
#define CAPTURE_INTERVAL_MS 30000  // 30 giây
#define CAPTURE_INTERVAL_MS 300000 // 5 phút
```

### Thay đổi ngưỡng phát hiện bất thường

Trong `server/anomaly_detector.py`:
```python
SPIKE_THRESHOLD  = 3.0   # Tăng >3x mức TB → cảnh báo spike
OFFLINE_HOURS    = 2     # Không online >2 giờ → cảnh báo offline
NIGHT_KWH_LIMIT  = 1.5  # >1.5 kWh/h ban đêm → cảnh báo
```

---

## 🐛 Troubleshooting

### UnicodeEncodeError khi chạy server

```
UnicodeEncodeError: 'charmap' codec can't encode character...
```
**Giải pháp**: Dùng `run_server.bat` hoặc đặt biến môi trường:
```powershell
$env:PYTHONUTF8="1"; python app.py
```

### EasyOCR không download được model

```
ConnectionError: Unable to download detection model
```
**Giải pháp**: Kiểm tra kết nối internet. Model (~200MB) được download một lần vào thư mục `server/ocr_models/`.

### ESP32-CAM không kết nối được server

- Đảm bảo ESP32 và máy tính **cùng mạng WiFi**
- Kiểm tra IP máy tính: `ipconfig` (Windows) / `ifconfig` (Linux)
- Cập nhật `SERVER_HOST` trong esp32
- Mở port 5000 trên Windows Firewall

### OCR confidence thấp / đọc sai số

- Đảm bảo ánh sáng đủ (dùng Flash LED)
- Lau sạch mặt kính công tơ
- Điều chỉnh khoảng cách camera 10–20cm
- Giảm `CAPTURE_INTERVAL_MS` để có nhiều ảnh hơn

---

## 🤝 Đóng góp

Pull Request và Issues luôn được chào đón!

1. Fork repository
2. Tạo branch: `git checkout -b feature/ten-tinh-nang`
3. Commit: `git commit -m 'Add: mô tả tính năng'`
4. Push: `git push origin feature/ten-tinh-nang`
5. Mở Pull Request

---

## 📄 License

MIT License — xem file [LICENSE](LICENSE) để biết thêm chi tiết.

---

<div align="center">

**⭐ Nếu project này hữu ích, hãy để lại một star!**

Made with ❤️ using ESP32-CAM × Python × AI OCR

</div>
