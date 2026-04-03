# YOLO Farm Frontend (React Native/Expo)

Dự án frontend của YOLO Farm được phát triển dựa trên **React Native** kết hợp bộ framework **Expo**. 
Với nền tảng này, dự án hỗ trợ xuất bản và chạy đa nền tảng một cách trơn tru, bao gồm:
- **Web App**: Hỗ trợ chạy trên trình duyệt web như một Single Page Application.
- **Mobile App**: Có thể biên dịch thành file ứng dụng cho Android hoặc iOS nếu cần.

## Cấu trúc thư mục

Nằm bên trong `apps/mobile`:

- `App.tsx`: Điểm khởi chạy của dự án, bao bọc toàn ứng dụng với hệ thống Navigation và GestureHandler.
- `src/components/`: Chứa các Component dùng chung (ví dụ: `CustomHeader.tsx`).
- `src/navigation/`: Quản lý các cấu hình liên quan đến điều hướng. Dự án dùng `DrawerNavigator.tsx` để render Sidebar.
- `src/screens/`: Chứa các màn hình chính yếu:
  - `HomeScreen.tsx` (Tổng quan)
  - `DevicesScreen.tsx` (Quản lý thiết bị)
  - `AnalyticsScreen.tsx` (Biểu đồ dữ liệu)

## Cách khởi chạy dự án

Bạn phải đứng từ thư mục `apps/mobile` để chạy các script.

```bash
cd apps/mobile

# Cài đặt toàn bộ dependencies (nếu chưa cài)
npm install

# Chạy server ứng dụng dành cho nền tảng Web
npm run web
```
*Note: Lúc này Expo web server sẽ khởi tạo và cung cấp một link localhost (VD: `http://localhost:8081` hoặc `8082`).*

## Luồng hoạt động & Tích hợp API

Ứng dụng sẽ kết nối với REST API từ Backend (yêu cầu Backend chạy song song ở `http://localhost:3001`).

### 1. Màn hình Quản lý thiết bị (`DevicesScreen.tsx`)
- Tự động gọi API `GET /telemetry/latest?type=[kiểu_thiết_bị]` (ví dụ: *fan*, *pump*, *speaker*) cách mỗi 10 giây để đồng bộ tự động trạng thái nguồn giữa frontend và backend.
- Hiển thị Switch cho phép On/Off thiết bị. Khi tương tác bật/tắt, Frontend sẽ bắn API `POST /commands/[id]` kèm theo giá trị lệnh `"ON"` / `"OFF"`.
- Có hỗ trợ tính năng **Optimistic UI Upates**. Nếu API báo lỗi trong quá trình thực hiện control, thanh kéo switch sẽ tự động nhảy giật ngược về trạng thái đúng đằng trước.

### 2. Màn hình Analytics (`AnalyticsScreen.tsx`)
- Sử dụng package `react-native-chart-kit` để trực quan hoá dữ liệu theo mốc thời gian.
- Hiển thị 4 loại thuộc tính đo đạc: `Temperature`, `Air Humidity`, `Soil Humidity`, và `Light Intensity`.
- Query lấy dữ liệu lịch sử từ API GET `/telemetry?type=[type]`. Mỗi 10 giây hệ thống sẽ auto refresh để lấy mốc thông số mới nhất nhằm render trực tiếp lên point line.

## Các Packages chính đang sử dụng
- `@react-navigation/...`: Hệ thống routing React Navigation v7 cho Drawer/Stack.
- `react-native-chart-kit`: Biểu đồ UI.
- `@expo/vector-icons`: Icon thông dụng.
- Cơ chế `fetch` API Browser mặc định cho liên kết mạng. 
