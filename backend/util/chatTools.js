// Function-calling tools cho chatbot FoodGo: KHAI BAO (functionDeclarations,
// dua cho OpenAI) + EXECUTOR (chay tren DB THAT). Moi executor chi nhan
// `ctx.userId` tu CHINH phien dang chat (gan boi chatController, khong bao
// gio tu args cua model) - model khong the "ao giac" userId/orderId cua
// nguoi khac de doc duoc du lieu khong phai cua ho.
import { mapFood } from "../db/mappers.js";
import { searchFoods } from "../db/foodSearch.js";
import { listOrdersForUser, toOrder } from "../db/orders.js";

export const chatToolDeclarations = [
  {
    name: "search_menu",
    description:
      "Tim mon an trong thuc don THAT cua FoodGo theo tu khoa, danh muc, khoang gia hoac danh gia toi thieu. "
      + "Luon dung tool nay khi khach hoi ve mon an/gia/danh muc - KHONG tu doan ten mon, gia hoac danh muc.",
    parameters: {
      type: "object",
      properties: {
        keyword: { type: "string", description: "Tu khoa tim theo ten hoac mo ta mon, co the bo trong" },
        categoryName: { type: "string", description: "Ten danh muc - phai la mot danh muc THAT dang co o FoodGo" },
        minPrice: { type: "number", description: "Gia toi thieu (VND)" },
        maxPrice: { type: "number", description: "Gia toi da (VND)" },
        minRating: { type: "number", description: "Diem danh gia trung binh toi thieu, 1-5" },
      },
    },
  },
  {
    name: "get_food_detail",
    description: "Lay thong tin chi tiet (gia, mo ta, diem danh gia) cua MOT mon an theo ten.",
    parameters: {
      type: "object",
      properties: { foodName: { type: "string", description: "Ten mon can tra cuu" } },
      required: ["foodName"],
    },
  },
  {
    name: "get_my_order_status",
    description:
      "Lay danh sach cac don hang GAN NHAT cua chinh nguoi dang chat (trang thai, mon, tong tien). "
      + "KHONG nhan tham so - luon tu dong gioi han theo nguoi dang dang nhap, khong the dung de xem don cua nguoi khac.",
    parameters: { type: "object", properties: {} },
  },
];

export const executeChatTool = async (name, args, ctx) => {
  switch (name) {
    case "search_menu": {
      const rows = await searchFoods({
        keyword: args?.keyword,
        categoryName: args?.categoryName,
        minPrice: args?.minPrice,
        maxPrice: args?.maxPrice,
        minRating: args?.minRating,
        limit: 10,
      });
      return { foods: rows.map(mapFood) };
    }
    case "get_food_detail": {
      if (!args?.foodName) return { food: null, message: "Thiếu tên món cần tra cứu" };
      const rows = await searchFoods({ keyword: args.foodName, limit: 1 });
      return rows.length > 0
        ? { food: mapFood(rows[0]) }
        : { food: null, message: "Không tìm thấy món này trong thực đơn hiện tại" };
    }
    case "get_my_order_status": {
      const { rows } = await listOrdersForUser({ userId: ctx.userId, limit: 5, skip: 0 });
      return { orders: rows.map(toOrder) };
    }
    default:
      return { error: `Không có tool tên "${name}"` };
  }
};
