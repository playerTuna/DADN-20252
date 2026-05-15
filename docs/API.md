# YOLO Farm System API

Tài liệu này tổng hợp các API hiện có của backend NestJS trong monorepo `DADN-20252`. Nội dung được cập nhật theo controller, DTO và service ở `apps/backend/src`.

## Tổng quan

- Base URL mặc định ở local: `http://localhost:3001`
- Backend bật CORS cho các origin local phổ biến của Vite, Expo và React dev server
- Trừ các route có đánh dấu public, toàn bộ API dùng JWT Bearer token
- `ValidationPipe` đang bật `whitelist`, `forbidNonWhitelisted`, `transform`
- Nhóm API `me`, `settings`, `devices`, `automation`, `analytics` chủ yếu theo user hiện tại
- Nhóm API `telemetry`, `alerts` và `commands/logs` đang phản ánh dữ liệu vận hành toàn hệ thống

## Xác thực

### Public routes

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`

### Protected routes

Các route còn lại đều yêu cầu:

```http
Authorization: Bearer <access_token>
Accept: application/json
```

### Header dùng trong hệ thống

- `Authorization`: access token cho route protected
- `Idempotency-Key`: chống gửi lặp cho các route điều khiển thiết bị
- `Last-Event-ID`: dùng được cho SSE reconnect nếu client hỗ trợ

## Kiểu dữ liệu chính

### Telemetry type

- `temp`
- `air_humidity`
- `soil_humidity`
- `light`
- `fan`
- `pump`
- `speaker`
- `rgb`
- `status`
- `stream`

### Sensor type dùng cho analytics

- `temp`
- `air_humidity`
- `soil_humidity`
- `light`

### Device điều khiển được

- `fan`
- `pump`
- `speaker`
- `rgb`

### Giá trị toggle thường dùng

- `ON`
- `OFF`
- `1`
- `0`

---

## 1) Health

### GET `/health`

Kiểm tra backend đang chạy.

**Auth**: public

**Response 200**

```json
{
  "ok": true,
  "ts": "2026-05-15T08:00:00.000Z"
}
```

---

## 2) Auth

### POST `/auth/register`

Tạo tài khoản mới, đồng thời trả về access token và refresh token.

**Auth**: public

**Body**

```json
{
  "email": "farmer@example.com",
  "password": "abc12345"
}
```

**Validation**

- `email` phải đúng định dạng email
- `password` tối thiểu 8 ký tự

**Response 201/200**

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "68258f0a4b3f14518ac74e91",
    "email": "farmer@example.com"
  }
}
```

### POST `/auth/login`

Đăng nhập bằng email và mật khẩu.

**Auth**: public

**Body**

```json
{
  "email": "farmer@example.com",
  "password": "abc12345"
}
```

**Response 200**

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "user": {
    "id": "68258f0a4b3f14518ac74e91",
    "email": "farmer@example.com"
  }
}
```

### POST `/auth/refresh`

Đổi refresh token lấy cặp token mới. Backend revoke session cũ và tạo session mới.

**Auth**: public

**Body**

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response 200**

```json
{
  "accessToken": "new-access-token",
  "refreshToken": "new-refresh-token"
}
```

### POST `/auth/logout`

Thu hồi session hiện tại theo refresh token.

**Auth**: public

**Body**

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response 200**

```json
{
  "ok": true
}
```

---

## 3) User, Dashboard, Settings, Devices

### GET `/me`

Lấy hồ sơ người dùng hiện tại.

**Auth**: required

**Response 200**

```json
{
  "id": "68258f0a4b3f14518ac74e91",
  "email": "farmer@example.com",
  "displayName": "farmer"
}
```

### PATCH `/me`

Cập nhật tên hiển thị.

**Auth**: required

**Body**

```json
{
  "displayName": "Nguyen Van A"
}
```

**Validation**

- `displayName`: chuỗi, dài từ 1 đến 64 ký tự

**Response 200**

```json
{
  "id": "68258f0a4b3f14518ac74e91",
  "email": "farmer@example.com",
  "displayName": "Nguyen Van A"
}
```

### GET `/dashboard`

Trả về dữ liệu dashboard cho 3 nhóm màn hình: `home`, `analytics`, `devices`.

**Auth**: required

**Response 200**

```json
{
  "home": {
    "title": "Home - Dashboards",
    "stats": [
      { "label": "Temperature", "value": "31", "icon": "thermometer-outline" }
    ],
    "controls": [
      {
        "id": "pump",
        "name": "Pump (Water)",
        "state": "online",
        "mode": "auto",
        "type": "pump",
        "enabled": true
      }
    ],
    "alerts": [
      {
        "id": "6825900f...",
        "text": "Temperature high",
        "time": "09:32 AM"
      }
    ]
  },
  "analytics": {
    "title": "Analytics - Dashboards",
    "stats": [],
    "controls": [],
    "alerts": []
  },
  "devices": {
    "title": "Devices - Dashboards",
    "stats": [],
    "controls": [],
    "alerts": []
  }
}
```

### GET `/features`

Lấy feature flags mà frontend đang dùng.

**Auth**: required

**Response 200**

```json
{
  "analyticsBeta": false,
  "deviceSchedules": true,
  "alertPush": true
}
```

### GET `/settings`

Lấy bộ cài đặt hiển thị/thiết bị của user. Backend sẽ tự merge với default settings nếu user chưa đủ key.

**Auth**: required

**Response 200**

```json
{
  "pump-1": true,
  "pump-2": false,
  "led-1": true,
  "led-2": true,
  "led-3": false,
  "schedule-1": true,
  "schedule-2": true,
  "schedule-3": false,
  "dev-1": true,
  "dev-2": false,
  "dev-3": true,
  "dev-4": true
}
```

### PATCH `/settings`

Cập nhật một phần settings của user.

**Auth**: required

**Body**

```json
{
  "pump-1": false,
  "led-2": false
}
```

**Response 200**

Trả về object settings sau khi merge.

### GET `/devices`

Lấy danh sách thiết bị đang được backend quản lý cho user hiện tại.

**Auth**: required

**Response 200**

```json
[
  {
    "id": "pump",
    "name": "Pump (Water)",
    "autoMode": true,
    "power": true,
    "desiredPower": true,
    "actualPower": true,
    "lastCommandStatus": "acked",
    "lastCommandAt": "2026-05-15T08:12:00.000Z",
    "lastAckAt": "2026-05-15T08:12:02.000Z",
    "lastSeenAt": "2026-05-15T08:12:02.000Z",
    "connectionStatus": "online"
  }
]
```

### PATCH `/devices/auto-mode`

Toggle trạng thái auto mode của một thiết bị. API này không truyền giá trị `true/false` trực tiếp, mà đảo trạng thái hiện tại.

**Auth**: required

**Body**

```json
{
  "id": "pump"
}
```

**Response 200**

Trả về lại danh sách thiết bị sau khi cập nhật.

---

## 4) Automation

### GET `/automation/rules`

Lấy danh sách rule automation của user.

**Auth**: required

**Response 200**

```json
[
  {
    "_id": "68259148...",
    "deviceId": "pump",
    "target": "pump",
    "enabled": true,
    "turnOnConditions": [
      { "sensorKey": "soilMoisture", "operator": "<", "value": 40 }
    ],
    "turnOffConditions": [
      { "sensorKey": "soilMoisture", "operator": ">", "value": 70 }
    ],
    "schedules": [],
    "onPayload": "ON",
    "offPayload": "OFF"
  }
]
```

### PATCH `/automation/rules/:deviceId`

Cập nhật một phần rule automation theo `deviceId`.

**Auth**: required

**Path params**

- `deviceId`: thường là `pump`, `fan`, `rgb`

**Body**

```json
{
  "enabled": true,
  "turnOnConditions": [
    { "sensorKey": "temperature", "operator": ">", "value": 32 }
  ],
  "turnOffConditions": [
    { "sensorKey": "temperature", "operator": "<", "value": 28 }
  ],
  "schedules": [
    {
      "time": "18:30",
      "action": "ON",
      "enabled": true,
      "conditions": [
        { "sensorKey": "light", "operator": "<", "value": 35 }
      ]
    }
  ],
  "onPayload": "ON",
  "offPayload": "OFF"
}
```

**Validation**

- `sensorKey`: `soilMoisture | temperature | light`
- `operator`: `< | >`
- `action`: `ON | OFF`
- `enabled`: boolean

**Response 200**

Trả về toàn bộ danh sách rule sau khi cập nhật.

### GET `/automation/logs`

Lấy log automation gần nhất của user, tối đa 50 bản ghi.

**Auth**: required

**Response 200**

```json
[
  {
    "_id": "6825920d...",
    "logId": "0d40c0f5-5a8f-4d4a-922d-7fae0a5d3b2a",
    "deviceId": "pump",
    "target": "pump",
    "sensorKey": "soilMoisture",
    "sensorValue": 28,
    "action": "ON",
    "payload": "ON",
    "reason": "Threshold met: soilMoisture(28)<40",
    "status": "sent",
    "createdAt": "2026-05-15T08:22:01.000Z",
    "commandId": "c3962d16-0c29-4f37-ae10-6dcbe00fd164"
  }
]
```

---

## 5) Analytics

### GET `/analytics/weekly-report`

Trả về báo cáo tuần cho user hiện tại.

**Auth**: required

**Query params**

- `from` (optional, ISO8601): thời điểm bắt đầu tuần cần thống kê

**Lưu ý phạm vi dữ liệu**

- `deviceActivity` được đếm theo user hiện tại
- Phần `sensors` và `alerts` lấy từ dữ liệu telemetry/alert toàn hệ thống đang được backend lưu

**Ví dụ**

- `/analytics/weekly-report`
- `/analytics/weekly-report?from=2026-05-11T00:00:00.000Z`

**Response 200**

```json
{
  "period": {
    "from": "2026-05-11T00:00:00.000Z",
    "to": "2026-05-17T23:59:59.999Z"
  },
  "sensors": {
    "temp": { "avg": 31.2, "min": 26, "max": 38, "deltaAvg": 1.4 },
    "air_humidity": { "avg": 73.5, "min": 60, "max": 84, "deltaAvg": -2.1 },
    "soil_humidity": { "avg": 48.8, "min": 25, "max": 81, "deltaAvg": 3.7 },
    "light": { "avg": 57.9, "min": 20, "max": 92, "deltaAvg": -0.8 }
  },
  "deviceActivity": {
    "pump": 14,
    "fan": 8,
    "speaker": 2
  },
  "alerts": {
    "temp": 3,
    "air_humidity": 1,
    "soil_humidity": 6,
    "light": 2
  }
}
```

---

## 6) Telemetry và Alerts

### GET `/telemetry/latest`

Lấy bản ghi telemetry mới nhất, có thể lọc theo `type`.

**Auth**: required

**Query params**

- `type` (optional): một giá trị thuộc `Telemetry type`

**Response 200**

```json
{
  "_id": "6825942f...",
  "type": "soil_humidity",
  "feedKey": "yolo-farm-soil-humidity",
  "topic": "username/feeds/yolo-farm-soil-humidity",
  "raw": "40",
  "numericValue": 40,
  "thresholdLevel": "normal",
  "receivedAt": "2026-05-15T08:35:22.000Z",
  "createdAt": "2026-05-15T08:35:22.100Z",
  "updatedAt": "2026-05-15T08:35:22.100Z"
}
```

Nếu chưa có dữ liệu phù hợp, response có thể là `null`.

**Lưu ý**

- Dữ liệu telemetry hiện không tách riêng theo user

### GET `/telemetry`

Lấy lịch sử telemetry, sắp xếp mới nhất trước, giới hạn tối đa 1000 bản ghi.

**Auth**: required

**Query params**

- `type` (optional)
- `from` (optional, ISO8601)
- `to` (optional, ISO8601)

**Response 200**

```json
[
  {
    "_id": "6825942f...",
    "type": "temp",
    "feedKey": "yolo-farm-temp",
    "topic": "username/feeds/yolo-farm-temp",
    "raw": "31",
    "numericValue": 31,
    "thresholdLevel": "normal",
    "receivedAt": "2026-05-15T08:36:00.000Z"
  }
]
```

**Lưu ý**

- Đây là lịch sử telemetry toàn hệ thống, không phải dữ liệu riêng theo user

### GET `/alerts`

Lấy các cảnh báo threshold mới nhất, tối đa 50 bản ghi.

**Auth**: required

**Response 200**

```json
[
  {
    "_id": "68259531...",
    "type": "temp",
    "level": "high",
    "value": 41,
    "feedKey": "yolo-farm-temp",
    "topic": "username/feeds/yolo-farm-temp",
    "triggeredAt": "2026-05-15T08:40:00.000Z"
  }
]
```

**Lưu ý**

- Alert hiện được sinh từ telemetry chung của hệ thống, không partition theo user

---

## 7) Commands

Các route điều khiển thiết bị đều yêu cầu JWT và hỗ trợ header idempotency:

```http
Idempotency-Key: <unique-string>
```

Nếu gửi lại cùng key, backend sẽ không publish MQTT lặp mà trả về kết quả deduplicated.

### POST `/commands/fan`

**Body**

```json
{ "value": "ON" }
```

### POST `/commands/pump`

**Body**

```json
{ "value": "OFF" }
```

### POST `/commands/speaker`

**Body**

```json
{ "value": "ON" }
```

### POST `/commands/rgb`

**Body**

```json
{ "r": 28, "g": 102, "b": 238, "format": "csv" }
```

Hoặc:

```json
{ "r": 28, "g": 102, "b": 238, "format": "json" }
```

**Validation**

- `r`, `g`, `b`: số nguyên trong khoảng `0..255`
- `format`: optional, hiện dùng `csv` hoặc `json`

**Response 200 khi gửi thành công**

```json
{
  "ok": true,
  "commandId": "3a3e8cf1-57dc-4f3f-83af-5a76a6f7be93",
  "status": "sent"
}
```

**Response 200 khi bị deduplicate**

```json
{
  "ok": true,
  "deduplicated": true,
  "command": {
    "commandId": "3a3e8cf1-57dc-4f3f-83af-5a76a6f7be93",
    "target": "fan",
    "payload": "ON",
    "status": "sent"
  },
  "commandId": "3a3e8cf1-57dc-4f3f-83af-5a76a6f7be93"
}
```

### GET `/commands/logs`

Lấy command log mới nhất, tối đa 100 bản ghi.

**Auth**: required

**Response 200**

```json
[
  {
    "_id": "68259652...",
    "commandId": "3a3e8cf1-57dc-4f3f-83af-5a76a6f7be93",
    "target": "fan",
    "payload": "ON",
    "source": "manual",
    "status": "acked",
    "ackPayload": "ACK:3a3e8cf1-57dc-4f3f-83af-5a76a6f7be93",
    "issuedAt": "2026-05-15T08:45:00.000Z",
    "ackedAt": "2026-05-15T08:45:02.000Z"
  }
]
```

**Lưu ý**

- Endpoint này đang trả log command gần nhất của toàn hệ thống, không lọc theo user gửi lệnh

**Trạng thái command**

- `sent`: đã ghi log và publish MQTT thành công
- `acked`: thiết bị đã phản hồi ACK
- `timeout`: quá thời gian chờ ACK
- `failed`: publish lỗi hoặc ACK báo lỗi

---

## 8) Realtime SSE

### GET `/realtime/telemetry`

Stream telemetry realtime dạng Server-Sent Events.

**Auth**: required

**Query params**

- `type` (optional): lọc theo telemetry type

**Ví dụ**

- `/realtime/telemetry`
- `/realtime/telemetry?type=temp`

**Event format**

```text
event: telemetry
data: {"type":"temp","feedKey":"yolo-farm-temp","topic":"username/feeds/yolo-farm-temp","raw":"31","numericValue":31,"thresholdLevel":"normal","receivedAt":"2026-05-15T08:50:10.000Z"}
```

**Lưu ý**

- Vì route này cũng bị bảo vệ bởi JWT guard, client SSE cần cơ chế gửi `Authorization` header hoặc proxy/auth wrapper phù hợp

---

## 9) Mẫu lỗi thường gặp

### 400 Validation Error

Ví dụ RGB sai range:

```json
{
  "statusCode": 400,
  "message": [
    "r must not be greater than 255"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized

Ví dụ thiếu hoặc sai token:

```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

Hoặc với auth:

```json
{
  "statusCode": 401,
  "message": "Invalid credentials",
  "error": "Unauthorized"
}
```

### 404 Not Found

Ví dụ sai route:

```json
{
  "message": "Cannot GET /telemetry/type=soil_humidity",
  "error": "Not Found",
  "statusCode": 404
}
```

---

## 10) Gợi ý test nhanh

- `POST /auth/register` hoặc `POST /auth/login` để lấy token
- `GET /dashboard` để kiểm tra user state, telemetry tổng hợp và dashboard data
- `GET /devices` để xem trạng thái thiết bị đã đồng bộ chưa
- `POST /commands/pump` kèm `Idempotency-Key` để test luồng điều khiển
- `GET /commands/logs` để kiểm tra `sent/acked/timeout/failed`
- `GET /telemetry/latest?type=soil_humidity` để xác nhận ingest MQTT
- `GET /alerts` để kiểm tra alert generation
- `GET /analytics/weekly-report` để kiểm tra aggregate dữ liệu tuần

