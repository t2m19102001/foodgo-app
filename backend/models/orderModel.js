import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema(
  {
    foodId: { type: mongoose.Schema.Types.ObjectId, ref: "food", required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    image: { type: String, default: "" },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
    note: { type: String, default: "" },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true, index: true },
    clientRequestId: { type: String, trim: true },
    requestFingerprint: { type: String },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => items && items.length > 0,
        message: "Đơn hàng phải có ít nhất một món",
      },
    },
    amount: { type: Number, required: true, min: 0 },
    address: { type: addressSchema, required: true },
    paymentMethod: { type: String, enum: ["cod", "vnpay"], default: "cod" },
    paymentStatus: { type: String, enum: ["unpaid", "paid", "failed"], default: "unpaid" },
    vnpTxnRef: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
      index: true,
    },
    cancelReason: { type: String, default: "" },
    date: { type: Date, default: Date.now },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

orderSchema.index(
  { userId: 1, clientRequestId: 1 },
  { unique: true, partialFilterExpression: { clientRequestId: { $type: "string" } } }
);

orderSchema.virtual("isCancellable").get(function () {
  return ["pending", "confirmed"].includes(this.status);
});

const orderModel = mongoose.models.order || mongoose.model("order", orderSchema);

export default orderModel;
