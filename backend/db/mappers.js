// Chuyen row snake_case cua Postgres thanh JSON dung hinh ma app Android cho doi.
//
// Quan trong: khoa chinh luon phoi ra duoi ten "_id" (chuoi uuid), vi ca 7 model
// Gson deu khai bao @SerializedName("_id") private String id. Doi ten khoa nay
// la vo toan bo client.
//
// Gson bo qua field JSON la, nen tra thua field thi an toan; tra THIEU field thi
// Java nhan null/false/0.

export const mapUser = (row) => row && {
  _id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone,
  address: row.address,
  image: row.image,
  isAdmin: row.is_admin,
  isDriver: row.is_driver,
  isActive: row.is_active,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

export const mapCategory = (row) => row && {
  _id: row.id,
  name: row.name,
  image: row.image,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

// Can cot "category_name" tu JOIN categories: app doc Food.category la TEN danh
// muc dang chuoi, khong phai id.
export const mapFood = (row) => row && {
  _id: row.id,
  name: row.name,
  description: row.description,
  price: row.price,
  image: row.image,
  category: row.category_name,
  isAvailable: row.is_available,
  stock: row.stock,
  prepTimeMinutes: row.prep_time_minutes,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // Chi co gia tri khi query co JOIN view food_ratings (vd AI Search,
  // chatbot) - cac noi khac (addFood/updateFood/listFood thong thuong)
  // khong join nen ca hai deu null, Gson/JS bo qua field null an toan.
  avgRating: row.avg_rating != null ? Number(row.avg_rating) : null,
  reviewCount: row.review_count != null ? row.review_count : null,
};

export const mapOrderItem = (row) => ({
  foodId: row.food_id,
  name: row.name,
  price: row.price,
  quantity: row.quantity,
  image: row.image,
});

const CANCELLABLE = ["pending", "confirmed"];

// Smart ETA (xem migration 006 + util/eta.js). "prep_base_minutes" KHONG
// phoi ra JSON: day la gia tri TRUOC khi nhan he so tai, chi dung noi bo de
// attachEtaWarnings() (orderController.js) tinh lai do lech voi tai HIEN TAI
// - khong co nghia gi voi khach hang. Don dat truoc migration 006 khong co
// row delivery_estimates (LEFT JOIN ra toan NULL) -> tra null, app Android
// an card ETA khi gap null.
export const mapEta = (row) => (row.eta_total_minutes == null ? null : {
  confirmMinutes: row.eta_confirm_minutes,
  prepMinutes: row.eta_prep_minutes,
  deliveryMinutes: row.eta_delivery_minutes,
  totalMinutes: row.eta_total_minutes,
  estimatedReadyAt: row.eta_estimated_ready_at,
  estimatedDeliveredAt: row.eta_estimated_delivered_at,
  actualConfirmedAt: row.eta_actual_confirmed_at,
  actualShippedAt: row.eta_actual_shipped_at,
  actualDeliveredAt: row.eta_actual_delivered_at,
  // delayed/delayMinutes duoc GAN THEM boi attachEtaWarnings o controller:
  // can 1 query "tai hien tai" nen khong tinh duoc trong ham thuan nay.
});

// items duoc truyen vao rieng vi chung den tu bang order_items (hoac tu
// json_agg trong cung mot query).
export const mapOrder = (row, items = []) => row && {
  _id: row.id,
  userId: row.user_id,
  items: items.map(mapOrderItem),
  amount: row.amount,
  address: {
    fullName: row.ship_full_name,
    phone: row.ship_phone,
    address: row.ship_address,
    note: row.ship_note,
  },
  // Toa do snapshot luc dat don (module Maps) - null voi don dat truoc
  // migration 010 hoac dia chi khong chon tren ban do
  shipLat: row.ship_lat != null ? Number(row.ship_lat) : null,
  shipLng: row.ship_lng != null ? Number(row.ship_lng) : null,
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  status: row.status,
  cancelReason: row.cancel_reason,
  // Ban Mongo co ca "date" va "createdAt" lech nhau, list sort theo date con
  // stats group theo createdAt. Gio chi con mot nguon chan ly.
  date: row.created_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // Thay cho virtual isCancellable cua Mongoose. Don da tra tien thi server tra
  // 409 khi huy (phai hoan tien truoc), nen khong hien nut Huy cho khach.
  isCancellable: CANCELLABLE.includes(row.status) && row.payment_status !== "paid",
  // Tien VNPay ve cho don da het han/huy hoac ve hai lan: cho admin hoan tien
  refundRequired: Boolean(row.refund_required),
  eta: mapEta(row),
  // Chi hien khi dang 'shipped' VA da co vi tri - tu dong "het chia se" khi
  // don giao xong/huy, dung yeu cau bao mat cua spec (khong can code don rieng
  // de xoa/an vi tri, chi la dieu kien doc).
  driverLocation: row.status === "shipped" && row.driver_lat != null ? {
    lat: Number(row.driver_lat),
    lng: Number(row.driver_lng),
    updatedAt: row.driver_location_updated_at,
  } : null,
  // Chi co o API admin; app doc Order.customer
  customer: row.customer_name === undefined || row.customer_name === null
    ? undefined
    : { name: row.customer_name || "", email: row.customer_email || "", phone: row.customer_phone || "" },
};

// app doc Review.userId la OBJECT {_id, name, image} (ban Mongo dung populate)
export const mapReview = (row) => row && {
  _id: row.id,
  userId: {
    _id: row.user_id,
    name: row.user_name,
    image: row.user_image,
  },
  foodId: row.food_id,
  rating: row.rating,
  comment: row.comment,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

export const mapNotification = (row) => row && {
  _id: row.id,
  title: row.title,
  message: row.message,
  isRead: row.is_read,
  createdAt: row.created_at,
};

export const mapAddress = (row) => row && {
  _id: row.id,
  fullName: row.full_name,
  phone: row.phone,
  address: row.address,
  note: row.note,
  isDefault: row.is_default,
  lat: row.lat != null ? Number(row.lat) : null,
  lng: row.lng != null ? Number(row.lng) : null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};
