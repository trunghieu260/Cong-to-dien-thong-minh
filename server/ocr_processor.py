"""
============================================================
OCR_PROCESSOR.PY - Module Xử Lý Ảnh & Nhận Dạng Chữ Số
Công Tơ Điện Thông Minh
============================================================
Quy trình OCR:
  1. Nhận ảnh JPEG từ ESP32-CAM
  2. Tiền xử lý: grayscale → threshold → denoise
  3. Phát hiện vùng màn hình số công tơ
  4. OCR nhận dạng chữ số
  5. Validate & trả về kết quả
============================================================
"""

import cv2
import numpy as np
import re
import logging
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# Khởi tạo EasyOCR reader (lazy init để không chậm startup)
_easyocr_reader = None


def _get_ocr_reader():
    """Lazy initialization của EasyOCR reader."""
    global _easyocr_reader
    if _easyocr_reader is None:
        try:
            import easyocr
            _easyocr_reader = easyocr.Reader(
                ['en'],
                gpu=False,
                verbose=False,
                model_storage_directory='./ocr_models'
            )
            logger.info("EasyOCR reader khởi tạo thành công")
        except ImportError:
            logger.warning("EasyOCR không khả dụng, chuyển sang Tesseract")
    return _easyocr_reader


def preprocess_image(image_bytes: bytes) -> np.ndarray:
    """
    Tiền xử lý ảnh để tăng độ chính xác OCR.

    Args:
        image_bytes: Dữ liệu ảnh JPEG thô từ ESP32-CAM

    Returns:
        Ảnh đã xử lý dạng numpy array (grayscale)
    """
    # Decode JPEG bytes thành numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Không thể decode ảnh")

    # Bước 1: Chuyển sang grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Bước 2: Tăng độ tương phản bằng CLAHE
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(gray)

    # Bước 3: Làm mờ nhẹ để giảm nhiễu
    blurred = cv2.GaussianBlur(enhanced, (3, 3), 0)

    # Bước 4: Adaptive Threshold (xử lý tốt với ánh sáng không đều)
    thresh = cv2.adaptiveThreshold(
        blurred, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        blockSize=11,
        C=2
    )

    # Bước 5: Morphological operations để làm sạch
    kernel  = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)

    return cleaned, img


def detect_display_region(img: np.ndarray) -> Optional[np.ndarray]:
    """
    Phát hiện vùng màn hình số trên ảnh công tơ.
    Tìm hình chữ nhật có tỉ lệ phù hợp với màn hình LCD.

    Args:
        img: Ảnh gốc màu

    Returns:
        Ảnh vùng màn hình đã crop, hoặc None nếu không tìm thấy
    """
    gray    = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    edges   = cv2.Canny(blurred, 50, 150)

    # Tìm contours
    contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    h_img, w_img = img.shape[:2]
    best_region  = None
    best_score   = 0

    for cnt in contours:
        area = cv2.contourArea(cnt)
        # Lọc: diện tích phải đủ lớn (ít nhất 5% ảnh) nhưng không quá lớn
        if area < (h_img * w_img * 0.05) or area > (h_img * w_img * 0.5):
            continue

        # Xấp xỉ hình dạng
        peri   = cv2.arcLength(cnt, True)
        approx = cv2.approxPolyDP(cnt, 0.02 * peri, True)

        if len(approx) == 4:  # Hình tứ giác
            x, y, w, h = cv2.boundingRect(approx)
            aspect_ratio = w / h

            # Màn hình LCD công tơ thường có tỉ lệ 2:1 đến 5:1
            if 1.5 <= aspect_ratio <= 6.0:
                score = area * (1 / abs(aspect_ratio - 3.0) + 0.1)
                if score > best_score:
                    best_score  = score
                    best_region = img[y:y+h, x:x+w]

    return best_region


def extract_numbers_easyocr(image_region: np.ndarray) -> Tuple[str, float]:
    """
    Nhận dạng số bằng EasyOCR.

    Returns:
        Tuple (chuỗi số đọc được, độ tin cậy 0-1)
    """
    reader = _get_ocr_reader()
    if reader is None:
        return "", 0.0

    results = reader.readtext(
        image_region,
        allowlist='0123456789.',
        detail=1,
        paragraph=False,
        min_size=10
    )

    if not results:
        return "", 0.0

    # Ghép tất cả text lại, lọc chỉ lấy số
    all_text   = " ".join([r[1] for r in results])
    all_conf   = np.mean([r[2] for r in results])

    # Lọc chỉ lấy chữ số và dấu chấm
    numbers_only = re.sub(r'[^0-9.]', '', all_text)

    return numbers_only, float(all_conf)


def extract_numbers_tesseract(image_region: np.ndarray) -> Tuple[str, float]:
    """
    Nhận dạng số bằng Tesseract OCR (fallback).

    Returns:
        Tuple (chuỗi số đọc được, độ tin cậy)
    """
    try:
        import pytesseract
    except ImportError:
        logger.error("pytesseract không được cài đặt")
        return "", 0.0

    # Phóng to ảnh để Tesseract hoạt động tốt hơn
    scale       = 3
    large       = cv2.resize(image_region, None, fx=scale, fy=scale,
                             interpolation=cv2.INTER_CUBIC)

    # Cấu hình Tesseract cho chữ số
    config      = '--psm 7 --oem 3 -c tessedit_char_whitelist=0123456789.'
    result      = pytesseract.image_to_data(large, config=config,
                                            output_type=pytesseract.Output.DICT)

    texts  = []
    confs  = []
    for i, conf in enumerate(result['conf']):
        if conf > 0 and result['text'][i].strip():
            texts.append(result['text'][i].strip())
            confs.append(conf / 100.0)

    if not texts:
        return "", 0.0

    combined = "".join(texts)
    avg_conf = float(np.mean(confs)) if confs else 0.0

    return combined, avg_conf


def validate_reading(raw_text: str, previous_value: Optional[float] = None) -> Optional[float]:
    """
    Validate và làm sạch kết quả OCR.

    Args:
        raw_text: Chuỗi số thô từ OCR
        previous_value: Chỉ số lần trước (để kiểm tra hợp lệ)

    Returns:
        Giá trị float hợp lệ hoặc None nếu không hợp lệ
    """
    # Làm sạch: chỉ giữ số và dấu chấm
    cleaned = re.sub(r'[^0-9.]', '', raw_text)

    if not cleaned:
        return None

    try:
        value = float(cleaned)
    except ValueError:
        return None

    # Kiểm tra khoảng hợp lệ (0 - 999999 kWh)
    if value < 0 or value > 999999:
        return None

    # Kiểm tra so với chỉ số cũ (không được giảm đáng kể)
    if previous_value is not None:
        if value < previous_value - 0.5:  # Cho phép sai số nhỏ
            logger.warning(f"Chỉ số giảm: {previous_value} → {value} (nghi ngờ trộm điện)")
            # Vẫn trả về nhưng sẽ trigger cảnh báo
        if value > previous_value + 500:  # Tăng quá nhiều
            logger.warning(f"Chỉ số tăng bất thường: {previous_value} → {value}")

    return round(value, 1)


def process_meter_image(image_bytes: bytes,
                        previous_value: Optional[float] = None) -> dict:
    """
    Hàm chính: xử lý ảnh và trả về kết quả OCR.

    Args:
        image_bytes: Ảnh JPEG thô từ ESP32-CAM
        previous_value: Chỉ số lần đọc trước

    Returns:
        Dict chứa: reading_value, confidence, raw_text, success, error
    """
    result = {
        "success":       False,
        "reading_value": None,
        "confidence":    0.0,
        "raw_text":      "",
        "error":         None,
        "method":        None
    }

    try:
        # Tiền xử lý ảnh
        processed, original = preprocess_image(image_bytes)
        logger.info(f"Tiền xử lý ảnh: {original.shape}")

        # Thử phát hiện vùng màn hình
        display_region = detect_display_region(original)

        if display_region is None:
            logger.info("Không tìm thấy vùng màn hình, dùng toàn bộ ảnh")
            display_region = original

        # Thử EasyOCR trước
        raw_text, confidence = extract_numbers_easyocr(display_region)
        result["method"] = "easyocr"

        # Fallback sang Tesseract nếu EasyOCR thất bại
        if not raw_text or confidence < 0.5:
            logger.info("EasyOCR confidence thấp, thử Tesseract...")
            raw_text_t, conf_t = extract_numbers_tesseract(processed)
            if conf_t > confidence:
                raw_text   = raw_text_t
                confidence = conf_t
                result["method"] = "tesseract"

        result["raw_text"]   = raw_text
        result["confidence"] = confidence

        # Validate kết quả
        value = validate_reading(raw_text, previous_value)

        if value is not None:
            result["success"]       = True
            result["reading_value"] = value
            logger.info(f"OCR thành công: {value} kWh (conf: {confidence:.2%})")
        else:
            result["error"] = f"Không thể parse giá trị từ: '{raw_text}'"
            logger.warning(result["error"])

    except Exception as e:
        result["error"] = str(e)
        logger.error(f"Lỗi xử lý ảnh: {e}", exc_info=True)

    return result
