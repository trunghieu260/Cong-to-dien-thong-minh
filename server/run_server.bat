@echo off
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
echo ===================================================
echo   CONG TO DIEN THONG MINH - OCR Server v1.0.0
echo ===================================================
echo   Server: http://localhost:5000
echo ===================================================
python app.py
pause
