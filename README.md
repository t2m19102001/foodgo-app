# FoodGo — Ứng dụng đặt & giao đồ ăn

Đồ án môn Lập trình ứng dụng di động: **app Android (Java, MVVM)** cho khách hàng và quản trị viên, **backend REST API Node.js + PostgreSQL**.

| | |
|---|---|
| App | Java, MVVM (Activity/Fragment → ViewModel → Repository → Retrofit), minSdk 24 |
| Backend | Node.js + Express + PostgreSQL (driver `pg`, SQL thuần, không ORM) |
| Xác thực | JWT 7 ngày, mật khẩu băm bcrypt, phân quyền user/admin |
| Thanh toán | COD và VNPay (sandbox) |

---

## 1. Tính năng

**Khách hàng:** đăng ký/đăng nhập (tự đăng nhập lại bằng token đã lưu) · trang chủ có tìm kiếm, lọc danh mục, món hết hàng bị làm mờ · chi tiết món kèm đánh giá · giỏ hàng lưu trên máy · sổ địa chỉ (có địa chỉ mặc định) · đặt hàng COD/VNPay · lịch sử đơn (phân trang, lọc trạng thái) · hủy đơn kèm lý do · theo dõi đơn 4 bước tự cập nhật mỗi 5 giây · đánh giá món đã nhận · thông báo kèm badge số chưa đọc · sửa hồ sơ, đổi mật khẩu.

**Quản trị viên** (`isAdmin = true`, mục QUẢN TRỊ trong trang Tài khoản): quản lý đơn hàng (lọc trạng thái, chuyển trạng thái theo đúng luồng, mỗi lần đổi đều sinh thông báo cho khách) · quản lý món ăn (CRUD kèm ảnh, bật/tắt hết hàng) · quản lý danh mục (không xóa/đổi tên danh mục đang có món) · thống kê doanh thu (tổng, theo trạng thái, 7 ngày gần nhất).

---

## 2. Chạy dự án

**Yêu cầu:** Node.js 22+ · Android Studio, JDK 17+, Android SDK API 37 · PostgreSQL 16+ (Neon, Supabase, hoặc Postgres local).

### Backend

```bash
cd backend
npm install
cp .env.example .env     # rồi điền giá trị
npm run migrate          # tạo 10 bảng + 1 view
npm run seed             # 5 danh mục, 9 món, trỏ vào ảnh demo có sẵn
npm run dev              # hoặc npm start
```

`.env` cần: `PORT`, `DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`, `CORS_ORIGINS`, và nhóm `VNPAY_*` nếu dùng VNPay (đăng ký sandbox tại https://sandbox.vnpayment.vn/devreg/). Để `PGSSL` trống với Postgres có TLS (Neon, Supabase); đặt `PGSSL=disable` với Postgres local không TLS.

`npm run migrate` chạy các file SQL trong `backend/migrations/` theo thứ tự tên, mỗi file đúng một lần (ghi lại trong bảng `schema_migrations`), nên gọi lại bao nhiêu lần cũng được.

Tạo tài khoản admin ngay khi seed:

```bash
ADMIN_EMAIL=admin@foodgo.vn ADMIN_PASSWORD='mat-khau-cua-ban' npm run seed
```

> `npm run seed` **xóa toàn bộ danh mục và món** đang có rồi tạo lại. Nếu `DATABASE_URL` không trỏ vào `localhost` hay DB có tên chứa `_test`, nó từ chối chạy — muốn chạy thật thì thêm `SEED_CONFIRM=1`.

> `JWT_SECRET` phải dài **tối thiểu 32 ký tự**, thiếu hoặc quá ngắn thì server từ chối khởi động — vì với secret rỗng, thư viện JWT vẫn ký ra token hợp lệ nên ai cũng tự tạo được token admin.

Log thành công: `PostgreSQL connected (foodgo)` → `Server is running on http://localhost:5000`.

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

Cách gọn nhất là truyền `ADMIN_EMAIL`/`ADMIN_PASSWORD` cho `npm run seed` (xem trên). Nếu đã đăng ký trong app rồi mới muốn cấp quyền admin, chạy SQL rồi đăng xuất/đăng nhập lại để app nhận quyền mới:

```sql
UPDATE users SET is_admin = true WHERE email = '<email-vua-dang-ky>';
```

---

## 3. API

Base URL `http://localhost:5000`. Token gửi ở header `Authorization: Bearer <token>`. Mọi phản hồi theo dạng `{ success, message, ...dữ liệu }`.
Quyền: **P** = công khai, **U** = cần đăng nhập, **A** = cần admin.

Import `docs/foodgo.postman_collection.json` vào Postman để bấm thử ngay (chạy *Auth / Đăng nhập* trước, token tự lưu cho các request sau).

| Nhóm | Endpoint | Quyền | Ghi chú |
|---|---|---|---|
| Health | `GET /api/health` | P | `200` khi PostgreSQL đã kết nối, `503` khi chưa |
| Auth | `POST /api/auth/register` · `POST /login` | P | Trả token. Giới hạn 10 lần/giờ (register) và 10 lần **sai**/15 phút (login) mỗi IP |
| | `GET /api/auth/profile` · `PUT /profile` · `PUT /change-password` | U | `PUT /profile` là multipart, field ảnh tên `image`. Đổi mật khẩu làm token cũ hết hiệu lực |
| Food | `GET /api/food?q=` · `GET /:id` · `GET /category/:category` | P | `page`/`limit` tùy chọn (`limit` ≤ 100); không truyền thì trả như cũ, chặn trên 200 bản ghi. `q` tìm **bỏ dấu**: gõ `pho bo` ra `Phở bò` |
| | `POST /api/food` · `PUT /:id` · `DELETE /:id` | A | Multipart; khi sửa, mọi field đều optional kể cả `isAvailable` và `stock` |
| Category | `GET /api/category` | P | Phân trang tùy chọn như `/api/food` |
| | `POST /api/category` · `PUT /:id` · `DELETE /:id` | A | **Đổi tên danh mục đang có món hoạt động bình thường** (khóa ngoại `ON UPDATE CASCADE`). Vẫn chặn **xóa** danh mục đang có món, do chính DB chặn (`ON DELETE RESTRICT`) |
| Order | `POST /api/order` | U | Gửi kèm `clientRequestId` (UUID); gửi lại cùng mã trả về đúng đơn cũ. Server tự tra giá từ DB, số tiền client gửi lên bị bỏ qua |
| | `GET /api/order/request/:clientRequestId` | U | Dò lại đơn sau khi mất mạng/timeout |
| | `GET /api/order/my?page=&limit=&status=` · `GET /:id` · `PUT /:id/cancel` | U | Chỉ thấy/hủy đơn của mình; hủy được khi đơn `pending` hoặc `confirmed` **và chưa thanh toán** (đơn đã trả tiền trả `409`, phải hoàn tiền trước). Hủy đơn hoàn lại tồn kho |
| | `POST /api/order/:id/vnpay/create-payment` | U | Trả `payUrl` để mở cổng VNPay. Chỉ cho đơn đang `pending`/`confirmed` — đơn đã hủy hoặc đã giao thì từ chối |
| | `GET /api/order/vnpay/return` · `GET /vnpay/ipn` | P | VNPay gọi về; xác thực chữ ký HMAC **và** đối chiếu `vnp_Amount`, `vnp_TxnRef`, `vnp_TransactionStatus`, `vnp_TmnCode`, ghi sổ vào bảng `payments` rồi mới cập nhật `paymentStatus`. Lệch số tiền trả `RspCode 04` |
| | `GET /api/order/list?page=&limit=&status=` · `GET /stats` | A | Toàn bộ đơn (kèm field `customer`) và thống kê doanh thu |
| | `PUT /api/order/:id/status` | A | Trả `409` nếu trạng thái đã bị đổi trước đó |
| Review | `GET /api/review/food/:foodId` | P | |
| | `POST /api/review` · `PUT /:id` · `DELETE /:id` | U | Chỉ đánh giá món đã nhận trong đơn `delivered`, mỗi người một đánh giá cho mỗi món |
| Notification | `GET /api/notification` · `PUT /:id/read` · `PUT /read-all` | U | Trả kèm `unreadCount` |
| Address | `GET /api/address` · `POST /` · `PUT /:id` · `PUT /:id/default` · `DELETE /:id` | U | Sổ địa chỉ của riêng từng tài khoản |

**Luồng trạng thái đơn:** `pending → confirmed → shipped → delivered`, hoặc `cancelled` từ `pending`/`confirmed`. `delivered` và `cancelled` là trạng thái kết thúc. Mỗi lần đổi đều ghi một dòng vào `order_status_history` kèm người thực hiện — vừa là dữ liệu cho tracker 4 bước, vừa là audit log.

**`paymentStatus`:** `unpaid → paid | failed`, và `paid → refunded`. Ràng buộc `orders_paid_not_cancelled` ở tầng DB không cho phép đơn vừa `paid` vừa `cancelled`: muốn hủy đơn đã thanh toán thì phải chuyển `paymentStatus` sang `refunded` trước.

**Tồn kho:** món có `track_stock = true` thì đặt hàng phải còn đủ `stock`, trừ bằng một câu `UPDATE ... WHERE stock >= :qty` nên hai đơn song song không thể cùng đi qua. Món `track_stock = false` (mặc định, và là trường hợp của mọi món thêm từ app) không giới hạn số lượng.

---

## 4. Kiểm thử

```bash
# 12 test thuần (không cần database) — luôn chạy được
cd backend && npm test

# 91 test, trong đó 79 test chạy trên PostgreSQL thật
cd backend && createdb foodgo_test
cd backend && TEST_DATABASE_URL=postgres://localhost/foodgo_test npm test

bash gradlew :app:testDebugUnitTest # 16 unit test JVM (JUnit 4 + Robolectric)

# Smoke test end-to-end: 92 kiểm tra gọi API thật (cần server đang chạy)
cd backend && npm start             # terminal 1 — khởi động lại để reset bộ đếm rate limit
cd backend && npm run test:e2e      # terminal 2

# 11 kiểm chứng schema trên DB thật (tồn kho, transaction, ledger, tìm kiếm)
cd backend && npm run verify:db
```

**Vì sao test chạy trên database thật thay vì mock.** Controller giờ là SQL thuần, nên mock DB chỉ chứng minh được "ta gọi đúng chuỗi ta đã viết" — không chứng minh được chuỗi SQL đó đúng. Trong chính lần chuyển đổi này, một bug `FOR UPDATE is not allowed with aggregate functions` đã lọt qua mọi suy luận và chỉ bị bắt khi chạy trên Postgres thật; mọi test mock sẽ pass trong khi API trả `500`. Chạy trên DB thật bắt được cả cú pháp SQL, `CHECK` constraint, index và hành vi transaction.

Không có `TEST_DATABASE_URL` thì 79 test DB được **skip** kèm thông báo chỉ cách chạy, 12 test thuần vẫn chạy. `TEST_DATABASE_URL` bắt buộc trỏ vào `localhost` hoặc DB có tên chứa `_test`, nếu không nó dừng ngay — vì mỗi test `TRUNCATE` toàn bộ bảng.

> `npm run test:e2e` ghi dữ liệu thật vào `DATABASE_URL` rồi **xóa sạch ở cuối**, kể cả ảnh đã upload (mọi bản ghi đều có tiền tố `e2e-`/`E2E `). Nó tự cấp quyền admin cho tài khoản test, nên từ chối chạy nếu `DATABASE_URL` không trỏ `localhost`/`_test` — muốn chạy thật thì thêm `E2E_CONFIRM=1`.

Smoke test đi qua: health + security headers + CORS · đăng ký/đăng nhập/phân quyền · hồ sơ và upload ảnh · CRUD danh mục/món ăn kèm các ràng buộc (gồm **đổi tên danh mục đang có món và món vẫn thuộc đúng danh mục**) · sổ địa chỉ · đặt hàng (gồm 3 request đồng thời cùng một `clientRequestId` chỉ tạo 1 đơn) · thông báo · toàn bộ luồng VNPay · đánh giá · chuyển trạng thái đơn · hủy đơn · thống kê · **IDOR: đơn của khách khác trả `403`, và người lạ không hủy được đơn** · đổi mật khẩu làm token cũ hết hiệu lực · rate limit trả `429` kèm `Retry-After`.

Test backend bao phủ, theo nhóm:

| File | Nội dung |
|---|---|
| `pure.test.js` | 25 cặp chuyển trạng thái đơn · phân trang (mặc định, trần, giá trị sai) · nhận dạng uuid |
| `media.test.js` | ảnh phải khớp magic byte · `deleteImageSafe` chặn path traversal |
| `vnpay.test.js` | chữ ký bị sửa hoặc sai secret đều bị từ chối · số tiền gửi đi ×100 |
| `auth.db.test.js` | chỉ lưu bcrypt hash · email trùng do `UNIQUE` chặn · **login không tiết lộ email có tồn tại hay không** · đổi mật khẩu tăng `token_version` |
| `authMiddleware.db.test.js` | token rác/hết hạn/sai secret · tài khoản bị khóa · `token_version` cũ · **`isAdmin` đọc từ DB nên token tự nhận là admin vẫn bị chặn**, thu quyền có hiệu lực tức thì |
| `order.db.test.js` | đặt hàng idempotent kể cả 3 request đồng thời · **2 đơn song song trên món còn 1 suất chỉ 1 thành công, không để lại đơn mồ côi** · hủy đơn hoàn lại tồn kho · `order_status_history` ghi đủ · thống kê doanh thu · không thanh toán được đơn đã hủy · không hủy được đơn đã trả tiền |
| `vnpayCallback.db.test.js` | **lệch số tiền → `RspCode 04`, không đổi `paymentStatus`** · `vnp_TransactionStatus` thất bại · sai `vnp_TmnCode` · `vnp_TxnRef` cũ bị từ chối · Return URL và IPN về **song song** vẫn chỉ 1 bản ghi ledger và 1 thông báo |
| `food.db.test.js` | hình dạng phân trang · `category` trả về là tên · **tìm kiếm bỏ dấu** · đổi tên danh mục đang có món · ảnh mới bị dọn khi update thất bại |
| `reviewNotification.db.test.js` | chỉ đánh giá được món đã nhận, và kiểm tra khóa theo đúng người + đúng món · xóa món thì review bị xóa theo · mọi truy vấn thông báo khóa theo `user_id` |
| `address.db.test.js` | **3 request thêm địa chỉ đầu tiên song song chỉ tạo 1 mặc định** · luôn còn đúng 1 mặc định · xóa mặc định thì tự promote địa chỉ khác |

Phía Android (16 test, không đổi trong lần chuyển DB này): `OrderStatusHelper`, `ApiErrorUtils`, `DateUtils`, `ImageUrlHelper`, `PaymentStatusHelper` và `CartRepository` (gộp số lượng, trừ đúng phần đã đặt, giỏ hàng tách riêng theo tài khoản).

---

## 5. Quyết định kỹ thuật

- **PostgreSQL thay vì MongoDB.** 5/7 collection cũ là bảng phẳng với khóa ngoại — dự án trả giá của document model mà không dùng lợi thế nào của nó. Bằng chứng rõ nhất: `food.category` lưu **tên** danh mục dạng String, nên đổi tên danh mục đang có món buộc phải chặn bằng `409`; với khóa ngoại `ON UPDATE CASCADE` thì việc đó chạy bình thường. Khóa chính là `uuid` và vẫn serialize ra khóa `_id`, nên **app Android không phải sửa một dòng nào** (cả 7 model Gson đều là `@SerializedName("_id") private String id`; dùng `serial` sẽ ra JSON number và Gson ném lỗi).
- **`pg` + SQL thuần, không ORM.** Với luồng tiền, `BEGIN`/`COMMIT` và điều kiện tranh chấp nên nhìn thấy được bằng mắt trong code thay vì ẩn sau abstraction. Migration là file SQL đọc được, chạy bởi `scripts/migrate.mjs` (~50 dòng) với bảng `schema_migrations`.
- **Không tin dữ liệu client:** khi đặt hàng, server tra lại tên/giá/ảnh từ DB, gộp dòng trùng, chặn món `isAvailable = false` rồi tự cộng tổng tiền. Giá và tổng tiền lưu `bigint` (VND) thay vì số thực.
- **Đặt hàng idempotent:** partial unique index `(user_id, client_request_id)` + `INSERT ... ON CONFLICT DO NOTHING`, nên mất mạng rồi bấm lại không tạo đơn trùng. Đổi trạng thái dùng optimistic concurrency (`UPDATE ... WHERE status = :cũ`, trả `409` khi đã có người đổi trước).
- **Lỗi nghiệp vụ trong transaction phải `throw`, không `return`.** `withTransaction` commit khi callback return bình thường, nên trả về một object lỗi sẽ **commit** những gì đã ghi. Đặt hàng `INSERT` đơn trước để chiếm khóa idempotency rồi mới trừ kho, nên nếu hết hàng mà chỉ `return` thì đơn mồ côi vẫn nằm lại — `util/httpError.js` tồn tại để tránh đúng cái bẫy đó.
- **Chống oversell bằng một câu lệnh:** `UPDATE foods SET stock = stock - :qty WHERE id = :id AND stock >= :qty` — kiểm và trừ trong cùng một write, nên hai đơn song song không thể cùng đi qua. Chỉ áp dụng cho món `track_stock = true` để không phá luồng admin hiện có của app (xem `migrations/002_track_stock.sql`).
- **Sổ giao dịch append-only:** mỗi callback VNPay ghi một dòng `payments` giữ nguyên payload, `UNIQUE (vnp_transaction_no)` + `ON CONFLICT DO NOTHING` làm idempotency nằm ở tầng DB. Nhờ vậy đối soát được với sao kê VNPay khi khách khiếu nại.
- **Chữ ký VNPay so bằng `crypto.timingSafeEqual`** thay vì `===` — nhưng chữ ký đúng mà không kiểm nội dung thì chỉ chống được giả mạo, nên callback còn đối chiếu `vnp_Amount`, `vnp_TxnRef`, `vnp_TransactionStatus` và `vnp_TmnCode`.
- **Luật nghiệp vụ nằm trong DB:** `CHECK` cho enum trạng thái, `orders_paid_not_cancelled` chặn đơn vừa giữ tiền vừa bị hủy, partial unique index chặn hai địa chỉ mặc định của cùng một người. Những ràng buộc này đúng kể cả khi code có đường nào đó bỏ sót.
- **Tìm kiếm tiếng Việt bỏ dấu:** hàm `vn_unaccent` khai báo `IMMUTABLE` (dùng `translate()` chứ không dùng `unaccent()` vốn là `STABLE` nên không index được) + GIN `pg_trgm` index trên `vn_unaccent(name)`.
- **`trust proxy`:** thiếu dòng này thì sau nginx/Render, `req.ip` là IP của proxy nên `express-rate-limit` đếm chung một bộ đếm cho mọi người dùng — 10 lần đăng nhập sai của một kẻ tấn công sẽ khóa đăng nhập của toàn bộ user. Ở local không bao giờ thấy.
- **Phần cứng hóa HTTP:** `helmet()` cho security headers, `express-rate-limit` ở `/login`, `/register`, `/change-password` và `POST /order`. CORS chỉ cho các origin trong `CORS_ORIGINS`; khi danh sách rỗng và không phải production thì chỉ `localhost` được phép. TLS tới Postgres **xác minh chứng chỉ** (`rejectUnauthorized: true`) — tắt xác minh là vẫn bị MITM, vô nghĩa với app có thanh toán.
- **Upload:** Multer giới hạn 5MB, kiểm tra **magic byte** của nội dung thật chứ không chỉ phần mở rộng; ảnh phục vụ tĩnh tại `/uploads`.
- **Log & health:** mọi log đi qua `util/logger.js` (có timestamp + level), mỗi request được log kèm status và thời gian xử lý — trừ query string của route VNPay, vì nó chứa `vnp_SecureHash` và số tiền. `GET /api/health` để nơi triển khai probe được. Mọi đường dẫn `/api` không tồn tại trả JSON `404` chứ không trả trang HTML.
- **ID sai định dạng trả `400`, không phải `500`:** `util/ids.js` kiểm uuid trước khi vào DB, nên client phân biệt được "ID sai" với "server chết".
- **R8 ở bản release:** `app/proguard-rules.pro` giữ tên field của `com.foodgo_app.model.**` vì Gson đọc dữ liệu theo tên field — nếu để R8 đổi tên, JSON sẽ parse ra `null` chỉ ở bản release.

## 6. Giới hạn đã biết

Những điểm dưới đây là lựa chọn có ý thức ở quy mô hiện tại:

- **`assembleRelease` tạo APK chưa ký.** Chưa có `signingConfigs`, nên APK release không cài được — cần thêm keystore trước khi phát hành.
- **Token lưu trong SharedPreferences chưa mã hóa.** `EncryptedSharedPreferences` đã bị Google deprecate (không còn bản phát hành mới), cách đúng hiện nay là Keystore + Tink/DataStore — thay đổi lớn hơn giá trị mang lại ở quy mô này. Rủi ro chỉ hiện thực hóa trên máy đã root; `allowBackup`/`dataExtractionRules` đã loại các prefs này khỏi backup và chuyển thiết bị.
- **Theo dõi đơn bằng polling 5 giây** thay vì WebSocket/FCM: không phụ thuộc hạ tầng ngoài, đủ cho thời gian theo dõi ngắn; đánh đổi là tốn request khi nhiều người theo dõi cùng lúc.
- **Ảnh lưu trên đĩa server** (`backend/uploads/`) thay vì S3/Cloudinary: đủ cho một instance, nhưng chặn chạy nhiều instance và chưa có sao lưu.
- **Chưa có đường hoàn tiền tự động.** `paymentStatus = refunded` phải do admin đặt bằng SQL; chưa gọi API hoàn tiền của VNPay.
- **Chưa có CI/CD, Docker, lint:** test chạy bằng lệnh tay như mục 4.
- **Chưa có shipper, phí giao hàng, khuyến mãi, bản đồ.** Trạng thái `shipped` do admin bấm tay và chưa gán được cho ai.
- **`npm audit` cảnh báo ở `nodemon`** (`chokidar` → `braces`): chỉ là devDependency, không nằm trong code chạy thật; `npm audit fix --force` sẽ hạ `nodemon` về bản 1.x nên không đáng đổi.
