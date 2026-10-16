# FoodGo — Ứng dụng đặt & giao đồ ăn

Đồ án môn Lập trình ứng dụng di động: **app Android (Java, MVVM)** cho khách hàng và quản trị viên, **backend REST API Node.js + MongoDB**.

| | |
|---|---|
| App | Java, MVVM (Activity/Fragment → ViewModel → Repository → Retrofit), minSdk 24 |
| Backend | Node.js + Express + MongoDB (Mongoose) |
| Xác thực | JWT 7 ngày, mật khẩu băm bcrypt, phân quyền user/admin |
| Thanh toán | COD và VNPay (sandbox) |

---

## 1. Tính năng

**Khách hàng:** đăng ký/đăng nhập (tự đăng nhập lại bằng token đã lưu) · trang chủ có tìm kiếm, lọc danh mục, món hết hàng bị làm mờ · chi tiết món kèm đánh giá · giỏ hàng lưu trên máy · sổ địa chỉ (có địa chỉ mặc định) · đặt hàng COD/VNPay · lịch sử đơn (phân trang, lọc trạng thái) · hủy đơn kèm lý do · theo dõi đơn 4 bước tự cập nhật mỗi 5 giây · đánh giá món đã nhận · thông báo kèm badge số chưa đọc · sửa hồ sơ, đổi mật khẩu.

**Quản trị viên** (`isAdmin = true`, mục QUẢN TRỊ trong trang Tài khoản): quản lý đơn hàng (lọc trạng thái, chuyển trạng thái theo đúng luồng, mỗi lần đổi đều sinh thông báo cho khách) · quản lý món ăn (CRUD kèm ảnh, bật/tắt hết hàng) · quản lý danh mục (không xóa/đổi tên danh mục đang có món) · thống kê doanh thu (tổng, theo trạng thái, 7 ngày gần nhất).

---

## 2. Chạy dự án

**Yêu cầu:** Node.js 18+ · Android Studio, JDK 17+, Android SDK API 37 · MongoDB Atlas hoặc MongoDB local.

### Backend

```bash
cd backend
npm install
cp .env.example .env     # rồi điền giá trị
npm run dev              # hoặc npm start
```

`.env` cần: `PORT`, `MONGO_URI`, `JWT_SECRET`, `NODE_ENV`, `CORS_ORIGINS`, và nhóm `VNPAY_*` nếu dùng VNPay (đăng ký sandbox tại https://sandbox.vnpayment.vn/devreg/).

> `JWT_SECRET` phải dài **tối thiểu 32 ký tự**, thiếu hoặc quá ngắn thì server từ chối khởi động — vì với secret rỗng, thư viện JWT vẫn ký ra token hợp lệ nên ai cũng tự tạo được token admin.

Log thành công: `MongoDB connected` → `Server is running on http://localhost:5000`.

### Android

1. Mở thư mục gốc bằng Android Studio, chờ Gradle sync, tạo `local.properties` trỏ `sdk.dir` tới Android SDK.
2. Chạy app (`Shift + F10`) hoặc build bằng lệnh:

```bash
bash gradlew assembleDebug    # APK: app/build/outputs/apk/debug/
bash gradlew installDebug     # cài vào thiết bị đang kết nối
```

Bản debug dùng `http://10.0.2.2:5000/` (địa chỉ localhost của máy host khi chạy emulator) và cho phép HTTP. Bản release yêu cầu URL HTTPS qua Gradle property, từ chối cleartext, không ghi log body, và bật R8:

```bash
bash gradlew assembleRelease -PFOODGO_API_BASE_URL=https://api.example.com/
```

### Tạo tài khoản

Không có tài khoản mặc định. Đăng ký trong app (mật khẩu ≥ 6 ký tự) rồi cấp quyền admin trực tiếp trong MongoDB, sau đó đăng xuất/đăng nhập lại để app nhận quyền mới:

```js
db.users.updateOne({ email: "<email-vua-dang-ky>" }, { $set: { isAdmin: true } })
```

---

## 3. API

Base URL `http://localhost:5000`. Token gửi ở header `Authorization: Bearer <token>`. Mọi phản hồi theo dạng `{ success, message, ...dữ liệu }`.
Quyền: **P** = công khai, **U** = cần đăng nhập, **A** = cần admin.

Import `docs/foodgo.postman_collection.json` vào Postman để bấm thử ngay (chạy *Auth / Đăng nhập* trước, token tự lưu cho các request sau).

| Nhóm | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| Health | `GET /api/health` | P | `200` khi MongoDB đã kết nối, `503` khi chưa |
| Auth | `POST /api/auth/register` · `POST /login` | P | Trả token. Giới hạn 10 lần/giờ (register) và 10 lần **sai**/15 phút (login) mỗi IP |
| | `GET /api/auth/profile` · `PUT /profile` · `PUT /change-password` | U | `PUT /profile` là multipart, field ảnh tên `image`. Đổi mật khẩu làm token cũ hết hiệu lực |
| Food | `GET /api/food` · `GET /:id` · `GET /category/:category` | P | `page`/`limit` tùy chọn (`limit` ≤ 100); không truyền thì trả như cũ, chặn trên 200 bản ghi |
| | `POST /api/food` · `PUT /:id` · `DELETE /:id` | A | Multipart; khi sửa, mọi field đều optional kể cả `isAvailable` |
| Category | `GET /api/category` | P | Phân trang tùy chọn như `/api/food` |
| | `POST /api/category` · `PUT /:id` · `DELETE /:id` | A | Chặn xóa/đổi tên danh mục đang có món |
| Order | `POST /api/order` | U | Gửi kèm `clientRequestId` (UUID); gửi lại cùng mã trả về đúng đơn cũ. Server tự tra giá từ DB, số tiền client gửi lên bị bỏ qua |
| | `GET /api/order/request/:clientRequestId` | U | Dò lại đơn sau khi mất mạng/timeout |
| | `GET /api/order/my?page=&limit=&status=` · `GET /:id` · `PUT /:id/cancel` | U | Chỉ thấy/hủy đơn của mình; hủy được khi đơn `pending` hoặc `confirmed` |
| | `POST /api/order/:id/vnpay/create-payment` | U | Trả `payUrl` để mở cổng VNPay |
| | `GET /api/order/vnpay/return` · `GET /vnpay/ipn` | P | VNPay gọi về; xác thực chữ ký HMAC rồi cập nhật `paymentStatus` |
| | `GET /api/order/list?page=&limit=&status=` · `GET /stats` | A | Toàn bộ đơn (kèm field `customer`) và thống kê doanh thu |
| | `PUT /api/order/:id/status` | A | Trả `409` nếu trạng thái đã bị đổi trước đó |
| Review | `GET /api/review/food/:foodId` | P | |
| | `POST /api/review` · `PUT /:id` · `DELETE /:id` | U | Chỉ đánh giá món đã nhận trong đơn `delivered`, mỗi người một đánh giá cho mỗi món |
| Notification | `GET /api/notification` · `PUT /:id/read` · `PUT /read-all` | U | Trả kèm `unreadCount` |
| Address | `GET /api/address` · `POST /` · `PUT /:id` · `PUT /:id/default` · `DELETE /:id` | U | Sổ địa chỉ của riêng từng tài khoản |

**Luồng trạng thái đơn:** `pending → confirmed → shipped → delivered`, hoặc `cancelled` từ `pending`/`confirmed`. `delivered` và `cancelled` là trạng thái kết thúc.

---

## 4. Kiểm thử

```bash
cd backend && npm test              # 34 unit test (node:test, mock model nên không cần MongoDB)
bash gradlew :app:testDebugUnitTest # 16 unit test JVM (JUnit 4 + Robolectric)

# Smoke test end-to-end: 88 kiểm tra gọi API thật (cần server đang chạy)
cd backend && npm start             # terminal 1 — khởi động lại để reset bộ đếm rate limit
cd backend && npm run test:e2e      # terminal 2
```

> `npm run test:e2e` ghi dữ liệu thật vào MongoDB trong `.env` rồi **xóa sạch ở cuối** (mọi bản ghi đều có tiền tố `e2e-`/`E2E `). Nó tự cấp quyền admin cho tài khoản test để chạy được cả nhóm API admin.

Smoke test đi qua: health + security headers + CORS · đăng ký/đăng nhập/phân quyền · hồ sơ và upload ảnh · CRUD danh mục/món ăn kèm các ràng buộc · sổ địa chỉ · đặt hàng (gồm 3 request đồng thời cùng một `clientRequestId` chỉ tạo 1 đơn) · thông báo · toàn bộ luồng VNPay (chữ ký giả bị từ chối và không đổi `paymentStatus`, chữ ký thật thì đơn sang `paid` + `confirmed`, gọi IPN lần 2 không xử lý trùng) · đánh giá · chuyển trạng thái đơn · hủy đơn · thống kê · đổi mật khẩu làm token cũ hết hiệu lực · rate limit trả `429` kèm `Retry-After`.

Unit test đang bao phủ: luồng trạng thái đơn và `409` khi trạng thái cũ · đặt hàng idempotent kể cả 2 request đồng thời · thống kê doanh thu · chặn email/mật khẩu không hợp lệ trước khi truy vấn DB · chỉ lưu bcrypt hash · đổi mật khẩu làm hết hiệu lực token cũ · chỉ đánh giá được món đã nhận · mọi truy vấn thông báo bị khóa theo `userId` · phân trang tùy chọn · chữ ký VNPay bị sửa hoặc sai secret đều bị từ chối · ảnh phải khớp magic byte · phía Android: `OrderStatusHelper`, `ApiErrorUtils`, `DateUtils`, `ImageUrlHelper`, `PaymentStatusHelper` và `CartRepository` (gộp số lượng, trừ đúng phần đã đặt, giỏ hàng tách riêng theo tài khoản).

---

## 5. Quyết định kỹ thuật

- **Không tin dữ liệu client:** khi đặt hàng, server tra lại tên/giá/ảnh từ DB, gộp dòng trùng, chặn món `isAvailable = false` rồi tự cộng tổng tiền.
- **Đặt hàng idempotent:** `clientRequestId` + unique index, nên mất mạng rồi bấm lại không tạo đơn trùng; đổi trạng thái dùng optimistic concurrency (`409` khi đã có người đổi trước).
- **Phần cứng hóa HTTP:** `helmet()` cho security headers, `express-rate-limit` chặn brute-force ở `/login` và `/register`. CORS chỉ cho các origin trong `CORS_ORIGINS`; khi danh sách rỗng và không phải production thì chỉ `localhost` được phép.
- **Upload:** Multer giới hạn 5MB, kiểm tra **magic byte** của nội dung thật chứ không chỉ phần mở rộng; ảnh phục vụ tĩnh tại `/uploads`.
- **Log & health:** mọi log đi qua `util/logger.js` (có timestamp + level), mỗi request được log kèm status và thời gian xử lý; `GET /api/health` để nơi triển khai probe được.
- **R8 ở bản release:** `app/proguard-rules.pro` giữ tên field của `com.foodgo_app.model.**` vì Gson đọc dữ liệu theo tên field — nếu để R8 đổi tên, JSON sẽ parse ra `null` chỉ ở bản release.
- **Chữ ký VNPay:** so sánh HMAC bằng `crypto.timingSafeEqual` thay vì `===`.

## 6. Giới hạn đã biết

Những điểm dưới đây là lựa chọn có ý thức trong phạm vi đồ án:

- **Token lưu trong SharedPreferences chưa mã hóa.** `EncryptedSharedPreferences` đã bị Google deprecate (không còn bản phát hành mới), cách đúng hiện nay là Keystore + Tink/DataStore — thay đổi lớn hơn giá trị mang lại ở quy mô này. Rủi ro chỉ hiện thực hóa trên máy đã root; `allowBackup`/`dataExtractionRules` đã loại các prefs này khỏi backup và chuyển thiết bị.
- **Theo dõi đơn bằng polling 5 giây** thay vì WebSocket/push: không phụ thuộc hạ tầng ngoài, đủ cho thời gian theo dõi ngắn; đánh đổi là tốn request khi nhiều người theo dõi cùng lúc.
- **Ảnh lưu trên đĩa server** (`backend/uploads/`) thay vì S3/Cloudinary: đủ cho một instance, nhưng chặn chạy nhiều instance và chưa có sao lưu.
- **Chưa có CI/CD, Docker:** test chạy bằng lệnh tay như mục 4.
- **`npm audit` cảnh báo ở `nodemon`** (`chokidar` → `braces`): chỉ là devDependency, không nằm trong code chạy thật; `npm audit fix --force` sẽ hạ `nodemon` về bản 1.x nên không đáng đổi.
