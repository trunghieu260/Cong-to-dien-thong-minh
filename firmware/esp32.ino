/*
============================================================
 ESP32-CAM SMART METER
 Live Stream + Upload ảnh mỗi 5 giây
 Board: AI Thinker ESP32-CAM
============================================================
*/


#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WebServer.h>


WebServer server(80);


// ================= WIFI =================

#define WIFI_SSID       "Chicken"
#define WIFI_PASSWORD   "26012004"


// ================= FLASK SERVER =================

#define SERVER_HOST       "192.168.100.3"
#define SERVER_PORT       5000
#define SERVER_UPLOAD_URL "/api/upload"


// ================= METER =================

#define METER_ID       "MTR-001"
#define DEVICE_TOKEN   "esp32cam-secret-token"


// ================= CAMERA AI THINKER =================

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


#define FLASH_LED_PIN 4



// ============================================================
// CAMERA INIT
// ============================================================

bool initCamera()
{

camera_config_t config;


config.ledc_channel = LEDC_CHANNEL_0;
config.ledc_timer   = LEDC_TIMER_0;


config.pin_d0 = Y2_GPIO_NUM;
config.pin_d1 = Y3_GPIO_NUM;
config.pin_d2 = Y4_GPIO_NUM;
config.pin_d3 = Y5_GPIO_NUM;
config.pin_d4 = Y6_GPIO_NUM;
config.pin_d5 = Y7_GPIO_NUM;
config.pin_d6 = Y8_GPIO_NUM;
config.pin_d7 = Y9_GPIO_NUM;


config.pin_xclk = XCLK_GPIO_NUM;
config.pin_pclk = PCLK_GPIO_NUM;
config.pin_vsync = VSYNC_GPIO_NUM;
config.pin_href = HREF_GPIO_NUM;


config.pin_sccb_sda = SIOD_GPIO_NUM;
config.pin_sccb_scl = SIOC_GPIO_NUM;


config.pin_pwdn  = PWDN_GPIO_NUM;
config.pin_reset = RESET_GPIO_NUM;


config.xclk_freq_hz = 20000000;
config.pixel_format = PIXFORMAT_JPEG;



if(psramFound())
{
    config.frame_size   = FRAMESIZE_VGA;
    config.jpeg_quality = 10;
    config.fb_count     = 2;
}
else
{
    config.frame_size   = FRAMESIZE_QVGA;
    config.jpeg_quality = 12;
    config.fb_count     = 1;
}



esp_err_t err =
esp_camera_init(&config);



if(err != ESP_OK)
{
    Serial.printf(
    "Camera error: 0x%x\n",
    err);

    return false;
}



sensor_t *s =
esp_camera_sensor_get();


s->set_brightness(s,0);
s->set_contrast(s,1);
s->set_sharpness(s,1);



Serial.println("Camera OK");


return true;

}



// ============================================================
// WIFI
// ============================================================

bool connectWiFi()
{

Serial.print("Connecting WiFi");


WiFi.begin(
WIFI_SSID,
WIFI_PASSWORD
);



while(WiFi.status()!=WL_CONNECTED)
{

delay(500);
Serial.print(".");

}



Serial.println();
Serial.println("WiFi OK");


Serial.print("ESP32 IP: ");

Serial.println(
WiFi.localIP()
);


return true;

}



// ============================================================
// CAPTURE IMAGE
// ============================================================

camera_fb_t* captureImage()
{


digitalWrite(
FLASH_LED_PIN,
HIGH
);


delay(200);



camera_fb_t *fb =
esp_camera_fb_get();



digitalWrite(
FLASH_LED_PIN,
LOW
);



if(!fb)
{

Serial.println(
"Capture failed"
);

return nullptr;

}



Serial.print(
"Image size: "
);

Serial.println(
fb->len
);



return fb;

}



// ============================================================
// UPLOAD FLASK
// ============================================================

bool uploadImage(camera_fb_t *fb)
{


String url =
"http://" +
String(SERVER_HOST) +
":" +
String(SERVER_PORT) +
SERVER_UPLOAD_URL;



Serial.println(url);



HTTPClient http;


http.begin(url);



http.addHeader(
"Content-Type",
"image/jpeg"
);


http.addHeader(
"X-Meter-ID",
METER_ID
);


http.addHeader(
"X-Device-Token",
DEVICE_TOKEN
);



int code =
http.POST(
fb->buf,
fb->len
);



Serial.print(
"HTTP Code: "
);

Serial.println(code);



if(code == 200)
{

Serial.println(
"UPLOAD SUCCESS"
);

http.end();

return true;

}



Serial.println(
http.errorToString(code)
);


http.end();


return false;

}



// ============================================================
// LIVE STREAM
// ============================================================

void handleStream()
{

WiFiClient client =
server.client();



client.println(
"HTTP/1.1 200 OK"
);

client.println(
"Content-Type: multipart/x-mixed-replace; boundary=frame"
);

client.println();



while(client.connected())
{


camera_fb_t *fb =
esp_camera_fb_get();



if(!fb)
break;



client.println(
"--frame"
);


client.println(
"Content-Type: image/jpeg"
);

client.println();



client.write(
fb->buf,
fb->len
);



client.println();


esp_camera_fb_return(fb);



delay(100);

}


}



// ============================================================
// SETUP
// ============================================================

void setup()
{


Serial.begin(115200);


delay(1000);



Serial.println();
Serial.println("====================");
Serial.println("SMART METER START");
Serial.println("====================");



pinMode(
FLASH_LED_PIN,
OUTPUT
);



if(!initCamera())
{
    return;
}



connectWiFi();



server.on(
"/stream",
HTTP_GET,
handleStream
);



server.begin();



Serial.println(
"STREAM READY"
);



}



// ============================================================
// LOOP
// ============================================================

void loop()
{


server.handleClient();



static unsigned long lastCapture = 0;



if(
millis() - lastCapture >= 5000
)
{

lastCapture =
millis();



Serial.println();
Serial.println(
"Capture..."
);



camera_fb_t *fb =
captureImage();



if(fb)
{


uploadImage(fb);



esp_camera_fb_return(fb);


}



}



delay(10);


}
