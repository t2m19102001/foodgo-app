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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};

export const mapOrderItem = (row) => ({
  foodId: row.food_id,
  name: row.name,
  price: row.price,
  quantity: row.quantity,
  image: row.image,
});

const CANCELLABLE = ["pending", "confirmed"];

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
  paymentMethod: row.payment_method,
  paymentStatus: row.payment_status,
  status: row.status,
  cancelReason: row.cancel_reason,
  // Ban Mongo co ca "date" va "createdAt" lech nhau, list sort theo date con
  // stats group theo createdAt. Gio chi con mot nguon chan ly.
  date: row.created_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  // Thay cho virtual isCancellable cua Mongoose
  isCancellable: CANCELLABLE.includes(row.status),
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
  createdAt: row.created_at,
  updatedAt: row.updated_at,
};
