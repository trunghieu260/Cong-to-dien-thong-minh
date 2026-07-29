// ============================================================
// CONFIG.H - Cấu hình ESP32-CAM Công Tơ Điện Thông Minh
// ============================================================
// Chỉnh sửa các thông số dưới đây trước khi upload firmware

#ifndef CONFIG_H
#define CONFIG_H

// ----------------------------------------------------------
// CẤU HÌNH WIFI
// ----------------------------------------------------------
#define WIFI_SSID         "Ten_WiFi_Cua_Ban"     // Tên WiFi
#define WIFI_PASSWORD     "Mat_Khau_WiFi"         // Mật khẩu WiFi
#define WIFI_TIMEOUT_MS   20000                   // Timeout kết nối (ms)

// ----------------------------------------------------------
// CẤU HÌNH SERVER
// ----------------------------------------------------------
#define SERVER_HOST       "192.168.1.100"         // IP máy chủ Flask
#define SERVER_PORT       5000                    // Port server
#define SERVER_UPLOAD_URL "/api/upload"           // Endpoint nhận ảnh
#define SERVER_TIMEOUT_MS 30000                   // Timeout gửi ảnh

// ----------------------------------------------------------
// THÔNG TIN THIẾT BỊ
// ----------------------------------------------------------
#define METER_ID          "MTR-001"               // ID công tơ duy nhất
#define METER_LOCATION    "Khu A, Phòng 101"      // Vị trí công tơ
#define DEVICE_TOKEN      "esp32cam-secret-token" // Token xác thực

// ----------------------------------------------------------
// CẤU HÌNH CHỤP ẢNH
// ----------------------------------------------------------
#define CAPTURE_INTERVAL_MIN   15       // Chụp mỗi X phút
#define DEEP_SLEEP_SECONDS     (CAPTURE_INTERVAL_MIN * 60)

// Độ phân giải camera (chọn 1 trong các giá trị sau)
// FRAMESIZE_QVGA  (320x240)  - Nhanh, ít chính xác
// FRAMESIZE_VGA   (640x480)  - Cân bằng tốt (khuyến nghị)
// FRAMESIZE_SVGA  (800x600)  - Chất lượng cao hơn
// FRAMESIZE_XGA   (1024x768) - Chất lượng cao
#define CAMERA_FRAMESIZE    FRAMESIZE_VGA

#define CAMERA_QUALITY      10          // JPEG quality (0-63, thấp hơn = tốt hơn)
#define FLASH_LED_PIN       4           // GPIO cho đèn flash
#define FLASH_DURATION_MS   500         // Thời gian bật đèn trước khi chụp

// ----------------------------------------------------------
// CẤU HÌNH PHẦN CỨNG
// ----------------------------------------------------------
// Pin mapping cho AI Thinker ESP32-CAM
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ----------------------------------------------------------
// CẤU HÌNH DEBUG
// ----------------------------------------------------------
#define DEBUG_MODE        true          // Bật/tắt Serial debug
#define SERIAL_BAUD_RATE  115200

#endif // CONFIG_H
