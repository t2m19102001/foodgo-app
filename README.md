# FoodGo — Ứng dụng đặt & giao đồ ăn

Đồ án môn Lập trình ứng dụng di động. Hệ thống gồm **ứng dụng Android (Java)** cho khách hàng và quản trị viên, kết hợp **backend REST API Node.js + MongoDB**.

| | |
|---|---|
| Ngôn ngữ app | Java (không dùng Kotlin / Compose) |
| Kiến trúc app | MVVM (Activity/Fragment → ViewModel → Repository → Retrofit) |
| Backend | Node.js + Express + MongoDB (Mongoose) |
| Xác thực | JWT (hạn 7 ngày), mật khẩu băm bằng bcrypt |

---

## 1. Tính năng

### Khách hàng
- Đăng ký, đăng nhập, tự động đăng nhập lại bằng token đã lưu.
- Trang chủ: danh sách món, lọc theo danh mục, tìm kiếm theo tên, kéo để làm mới, thêm nhanh vào giỏ.
- Món hết hàng được làm mờ, gắn nhãn **Hết hàng** và không cho thêm vào giỏ.
- Chi tiết món: ảnh, giá, mô tả, danh sách đánh giá của người dùng khác.
- Giỏ hàng lưu trên máy (SharedPreferences): tăng/giảm số lượng, xóa món, badge số lượng trên thanh tiêu đề.
- Đặt hàng COD: nhập người nhận, số điện thoại, địa chỉ, ghi chú.
- Lịch sử đơn hàng: phân trang vô hạn, **lọc theo trạng thái**.
- Chi tiết đơn: xem món, địa chỉ, tổng tiền, hủy đơn kèm lý do (khi đơn chưa giao).
- Theo dõi đơn hàng theo 4 bước, **tự cập nhật mỗi 5 giây**.
- Đánh giá món (1–5 sao + nhận xét) từ đơn hàng **đã giao**.
- Thông báo: danh sách, dấu chưa đọc, đánh dấu đã đọc / đã đọc tất cả, **badge số chưa đọc** ở thanh điều hướng.
- Tài khoản: xem và sửa hồ sơ (kèm tải ảnh đại diện), đổi mật khẩu, đăng xuất.

### Quản trị viên (tài khoản có `isAdmin = true`)
Mục **QUẢN TRỊ** trong trang Tài khoản chỉ hiện với tài khoản admin, gồm 4 màn hình:
- **Quản lý đơn hàng**: xem toàn bộ đơn của mọi khách hàng, lọc theo trạng thái, phân trang vô hạn. Chuyển trạng thái đơn theo đúng luồng cho phép: `Chờ xác nhận → Đã xác nhận → Đang giao → Đã giao`, hoặc hủy đơn (có bước xác nhận lại). Mỗi lần đổi trạng thái, hệ thống **tự sinh thông báo** cho khách hàng.
- **Quản lý món ăn**: thêm/sửa/xóa món ăn kèm ảnh, lọc theo danh mục, bật/tắt "hết hàng" ngay trên danh sách.
- **Quản lý danh mục**: thêm/sửa/xóa danh mục kèm ảnh; không xóa/đổi tên được danh mục đang có món ăn thuộc về nó.
- **Thống kê doanh thu**: tổng doanh thu các đơn đã giao, số đơn theo từng trạng thái, doanh thu 7 ngày gần nhất.

---

## 2. Kiến trúc

```
┌──────────────────────── ANDROID APP (Java, MVVM) ────────────────────────┐
│                                                                          │
│  Activity / Fragment  ──observe──►  ViewModel  ──►  Repository           │
│  (hiển thị, bắt sự kiện)            (LiveData)      (gọi API / local)    │
│                                                          │               │
│                                        ┌─────────────────┴────────┐      │
│                                        │                          │      │
│                                 ApiService (Retrofit)      CartRepository │
│                                        │                   (SharedPrefs)  │
│                                 AuthInterceptor                          │
│                                 (tự gắn Bearer token)                    │
└────────────────────────────────────────┼─────────────────────────────────┘
                                         │ HTTP / JSON
┌────────────────────────────────────────▼─────────────────────────────────┐
│                      BACKEND (Node.js + Express)                         │
│                                                                          │
│   Router ──► Middleware (auth / admin / upload) ──► Controller ──► Model  │
│                                                                 (Mongoose)│
└────────────────────────────────────────┼─────────────────────────────────┘
                                         ▼
                                   MongoDB (Atlas)
```

### Cấu trúc thư mục

```
TranMinhMan_LeNgocNhan_DoAn/
├── app/src/main/
│   ├── java/com/tranminhman_lengocnhan_doan/
│   │   ├── adapter/        RecyclerView adapter (món, giỏ, đơn, đánh giá, thông báo, đơn admin)
│   │   ├── api/            ApiClient, ApiService (Retrofit), AuthInterceptor
│   │   ├── model/          Model dữ liệu + model/response (request & response body)
│   │   ├── repository/     Tầng truy cập dữ liệu (API và giỏ hàng local)
│   │   ├── ui/             auth, home, cart, order, review, notification, profile, admin, main
│   │   └── util/           Constants, SessionManager, CurrencyUtils, DateUtils, ImageUrlHelper,
│   │                       OrderStatusHelper, ApiErrorUtils
│   └── res/                layout, drawable (vector tự vẽ), values (colors, styles, themes)
└── backend/
    ├── config/db.js        Kết nối MongoDB
    ├── controllers/        auth, food, category, order, review, notification
    ├── middleware/         auth.js (JWT + phân quyền), upload.js (Multer)
    ├── models/             user, food, category, order, review, notification
    ├── routers/            Khai báo route cho từng nhóm API
    ├── uploads/            Ảnh món ăn, danh mục, ảnh đại diện
    └── server.js           Điểm khởi động
```

---

## 3. Cài đặt và chạy

### Yêu cầu
- Node.js 18 trở lên
- Android Studio với JDK 17 trở lên, Android SDK API 37, emulator hoặc máy thật Android 7.0+ (API 24)
- MongoDB Atlas hoặc MongoDB cài trên máy

### Bước 1 — Backend

```bash
cd backend
npm install
cp .env.example .env     # Windows: copy .env.example .env
```

Mở `.env` và điền:

```
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/delivery_app
JWT_SECRET=mot_chuoi_bi_mat_dai_va_ngau_nhien
NODE_ENV=development
CORS_ORIGINS=
```

Khi dùng client web ở môi trường production, đặt `CORS_ORIGINS` thành danh sách origin được phép, ngăn cách bằng dấu phẩy. Ứng dụng Android không cần CORS.

Chạy server:

```bash
npm run dev      # tự khởi động lại khi sửa code (nodemon)
# hoặc
npm start
```

Log thành công:

```
MongoDB connected
Server is running on http://localhost:5000
```

### Bước 2 — Android

1. Mở thư mục gốc project bằng Android Studio, chờ Gradle sync xong.
2. Tạo `local.properties` với `sdk.dir` trỏ tới Android SDK trên máy. Bản debug dùng `http://10.0.2.2:5000/` cho emulator. Bản release nhận URL HTTPS qua Gradle property `FOODGO_API_BASE_URL`; ví dụ `bash gradlew assembleRelease -PFOODGO_API_BASE_URL=https://api.example.com/`. Gradle chặn build release nếu thiếu property này. Máy thật cần một backend HTTPS có thể truy cập từ thiết bị.

3. Chạy app (`Shift + F10`) hoặc build bằng dòng lệnh:

```bash
bash gradlew assembleDebug     # APK: app/build/outputs/apk/debug/app-debug.apk
bash gradlew installDebug      # cài trực tiếp vào thiết bị đang kết nối
```

> Chỉ bản debug cho phép HTTP để chạy với backend local. Bản release từ chối cleartext và không ghi log BODY.

### Bước 3 — Tạo tài khoản

Hệ thống **không có tài khoản mặc định**, mọi tài khoản nằm trong MongoDB. Đăng ký ngay trong app (mật khẩu tối thiểu 6 ký tự). Tạo tài khoản demo riêng cho mỗi môi trường và chuyển thông tin đăng nhập qua kênh riêng; không đưa mật khẩu vào repository.

Tài khoản đăng ký từ app luôn là khách hàng. Để có quyền admin, sửa trực tiếp trong MongoDB:

```js
// Mongo shell hoặc MongoDB Compass
db.users.updateOne({ email: "<email-admin-vua-dang-ky>" }, { $set: { isAdmin: true } })
```

Đăng xuất rồi đăng nhập lại để app nhận quyền mới (quyền được lưu trong token và session).

---

## 4. Danh sách API

Base URL: `http://localhost:5000`

Cột **Quyền**: `Công khai` = không cần token · `User` = cần đăng nhập · `Admin` = cần tài khoản admin.
Token gửi kèm ở header `Authorization: Bearer <token>` (middleware cũng chấp nhận header `token`).

### Auth — `/api/auth`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/register` | Công khai | Đăng ký, trả về token |
| POST | `/login` | Công khai | Đăng nhập, trả về token + `isAdmin` |
| GET | `/profile` | User | Lấy thông tin cá nhân |
| PUT | `/profile` | User | Cập nhật hồ sơ (multipart, field ảnh tên `image`) |
| PUT | `/change-password` | User | Đổi mật khẩu |

### Food — `/api/food`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/` | Công khai | Danh sách món |
| GET | `/:id` | Công khai | Chi tiết một món |
| GET | `/category/:category` | Công khai | Món theo danh mục |
| POST | `/` | Admin | Thêm món (multipart) |
| PUT | `/:id` | Admin | Sửa món (multipart, mọi field đều optional, kể cả `isAvailable`) |
| DELETE | `/:id` | Admin | Xóa món |

### Category — `/api/category`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/` | Công khai | Danh sách danh mục |
| POST | `/` | Admin | Thêm danh mục (multipart) |
| PUT | `/:id` | Admin | Sửa danh mục (multipart) |
| DELETE | `/:id` | Admin | Xóa danh mục |

### Order — `/api/order`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| POST | `/` | User | Đặt hàng với `clientRequestId` UUID. Server tự tra giá/tính tổng tiền; gửi lại cùng mã và nội dung sẽ trả đơn cũ |
| GET | `/request/:clientRequestId` | User | Kiểm tra đơn theo mã yêu cầu sau timeout (chỉ thấy đơn của mình) |
| GET | `/my?page=&limit=&status=` | User | Đơn của tôi, phân trang, lọc theo trạng thái |
| GET | `/:id` | User | Chi tiết đơn (chỉ chủ đơn hoặc admin) |
| PUT | `/:id/cancel` | User | Hủy đơn kèm lý do (chỉ khi `pending` hoặc `confirmed`) |
| GET | `/list?page=&limit=&status=` | Admin | Toàn bộ đơn, kèm thông tin khách trong field `customer` |
| PUT | `/:id/status` | Admin | Đổi trạng thái theo `pending → confirmed → shipped → delivered`, có thể hủy từ `pending/confirmed`; trả `409` khi trạng thái đã thay đổi |
| GET | `/stats` | Admin | Thống kê: `totalRevenue`, `totalOrders`, số đơn + doanh thu theo từng trạng thái (`byStatus`), doanh thu 7 ngày gần nhất (`last7Days`) |

### Review — `/api/review`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/food/:foodId` | Công khai | Đánh giá của một món |
| POST | `/` | User | Thêm đánh giá. **Chỉ được đánh giá món đã nhận trong đơn `delivered`**, mỗi người một đánh giá cho mỗi món |
| PUT | `/:id` | User | Sửa đánh giá của chính mình |
| DELETE | `/:id` | User | Xóa đánh giá của chính mình |

### Notification — `/api/notification`
| Method | Endpoint | Quyền | Mô tả |
|---|---|---|---|
| GET | `/` | User | Danh sách thông báo + `unreadCount` |
| PUT | `/:id/read` | User | Đánh dấu một thông báo đã đọc |
| PUT | `/read-all` | User | Đánh dấu tất cả đã đọc |

Mọi phản hồi theo dạng `{ "success": true/false, "message": "...", ...dữ liệu }`.

### Trạng thái đơn hàng

```
pending ──► confirmed ──► shipped ──► delivered
   │            │
   └────────────┴──► cancelled
```

`delivered` và `cancelled` là trạng thái kết thúc, không đổi tiếp được. Khách chỉ hủy được đơn ở `pending` hoặc `confirmed`.

---

## 5. Kịch bản demo

1. Đăng nhập tài khoản khách hàng → trang chủ: tìm kiếm, lọc danh mục, xem món hết hàng bị làm mờ.
2. Thêm món vào giỏ (badge tăng) → sửa số lượng trong giỏ → thanh toán COD → đặt hàng.
3. Mở Thông báo: có thông báo "Đặt hàng thành công" (badge trên thanh điều hướng sáng).
4. Đăng xuất, đăng nhập bằng tài khoản admin → **Tài khoản → Quản lý đơn hàng** → chuyển đơn lần lượt `Đã xác nhận → Đang giao → Đã giao`.
5. Đăng nhập lại tài khoản khách → mở Theo dõi đơn: 4 bước tự sáng dần (tự làm mới mỗi 5 giây), mỗi lần đổi trạng thái đều có thông báo mới.
6. Mở đơn đã giao → bấm **Đánh giá món này** → chọn sao, nhập nhận xét → xem đánh giá hiện ở trang chi tiết món.
7. Thử đánh giá một món chưa từng mua → bị backend từ chối (kiểm tra ràng buộc nghiệp vụ).
8. Lọc đơn theo trạng thái ở Lịch sử đơn; hủy một đơn `Chờ xác nhận` kèm lý do.

---

## 6. Ghi chú kỹ thuật

- **Không tin dữ liệu client**: khi đặt hàng, server tra lại tên/giá/ảnh từ MongoDB, gộp các dòng trùng món, chặn món `isAvailable = false` rồi tự cộng tổng tiền. Số tiền do app gửi lên bị bỏ qua.
- **Phân quyền**: `authMiddleware` xác thực JWT và kiểm tra tài khoản còn hoạt động (`isActive`); `adminMiddleware` kiểm tra thêm `isAdmin`. Màn admin trong app cũng tự kiểm tra session trước khi mở.
- **Theo dõi đơn bằng polling 5 giây** thay vì push notification: đủ cho bài toán theo dõi trong thời gian ngắn, không phụ thuộc hạ tầng ngoài (Firebase). Dừng polling khi đơn đã `delivered` hoặc `cancelled`.
- **Giỏ hàng lưu local** bằng SharedPreferences + Gson, không cần API giỏ hàng.
- **API admin trả `customer` riêng** thay vì `populate` trực tiếp vào `userId`, để model `Order` phía Android giữ `userId` là chuỗi và Gson không lỗi kiểu.
- **Ảnh**: upload bằng Multer, giới hạn 5MB, chỉ nhận `.jpg .jpeg .png .gif .webp`; ảnh phục vụ tĩnh tại `/uploads`. `ImageUrlHelper` ghép tên file thành URL đầy đủ.

---
