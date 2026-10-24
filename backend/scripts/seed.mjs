// Tao du lieu demo cho FoodGo tren PostgreSQL.
//
//   DATABASE_URL=postgres://... PGSSL=disable node scripts/seed.mjs
//
// Du lieu tro vao dung 14 anh da commit trong backend/uploads/, nen nguoi clone
// repo ve chay seed la co ngay 5 danh muc + 9 mon co anh that - khac voi truoc
// day, DB rong va 14 anh kia khong co document nao tham chieu.
//
// Tai khoan admin chi duoc tao khi truyen ADMIN_EMAIL va ADMIN_PASSWORD:
//   ADMIN_EMAIL=admin@foodgo.vn ADMIN_PASSWORD='...' npm run seed
// De trong thi script bo qua - khong tu tao admin voi mat khau doan duoc.
import "dotenv/config";
import bcrypt from "bcryptjs";
import pg from "pg";

const url = process.env.DATABASE_URL || "";
if (!url) {
  console.error("Thieu DATABASE_URL trong .env");
  process.exit(1);
}
// Seed XOA du lieu danh muc/mon dang co, nen phai chan truong hop tro vao DB that
if (!/localhost|127\.0\.0\.1|_test|foodgo_test/.test(url) && process.env.SEED_CONFIRM !== "1") {
  console.error("DATABASE_URL khong tro vao localhost hoac *_test.");
  console.error("Seed se XOA toan bo danh muc va mon dang co.");
  console.error("Neu chac chan, chay lai voi SEED_CONFIRM=1");
  process.exit(1);
}

// Gia tinh bang VND, so nguyen - khong dung so thuc cho tien
const CATEGORIES = [
  {
    name: "Bún & Phở",
    image: "cat-bnph.jpg",
    foods: [
      { name: "Phở bò tái nạm", price: 65000, stock: 40, image: "food-phbtinm.jpg",
        description: "Nước dùng ninh xương 8 tiếng, bánh phở tươi, tái và nạm mềm." },
      { name: "Bún bò Huế", price: 60000, stock: 35, image: "food-bnbhu.jpg",
        description: "Vị cay đậm kiểu Huế, kèm chả cua và móng giò." },
    ],
  },
  {
    name: "Cơm",
    image: "cat-cm.jpg",
    foods: [
      { name: "Cơm tấm sườn bì chả", price: 55000, stock: 50, image: "food-cmtmsnbch.jpg",
        description: "Sườn nướng than hoa, bì heo và chả trứng hấp, ăn kèm nước mắm chua ngọt." },
      { name: "Cơm gà xối mỡ", price: 52000, stock: 30, image: "food-cmgxim.jpg",
        description: "Da gà giòn, cơm chiên vàng, kèm gỏi bắp cải và canh rong biển." },
    ],
  },
  {
    name: "Ăn vặt",
    image: "cat-nvt.jpg",
    foods: [
      { name: "Bánh tráng trộn", price: 25000, stock: 60, image: "food-bnhtrngtrn.jpg",
        description: "Bánh tráng Tây Ninh, xoài xanh, khô bò, trứng cút và rau răm." },
      { name: "Gỏi cuốn tôm thịt (4 cuốn)", price: 35000, stock: 45, image: "food-gicuntmtht4cun.jpg",
        description: "Tôm luộc, thịt ba rọi, bún và rau thơm, chấm tương đậu phộng." },
    ],
  },
  {
    name: "Tráng miệng",
    image: "cat-trngming.jpg",
    foods: [
      { name: "Chè khúc bạch", price: 30000, stock: 25, image: "food-chkhcbch.jpg",
        description: "Khúc bạch phô mai, nhãn, hạnh nhân rang và nước đường hoa nhài." },
    ],
  },
  {
    name: "Đồ uống",
    image: "cat-ung.jpg",
    foods: [
      { name: "Trà sữa trân châu đường đen", price: 40000, stock: 70, image: "food-trsatrnchungen.jpg",
        description: "Trà đen ủ lạnh, sữa tươi, trân châu đường đen nấu mỗi 4 tiếng." },
      { name: "Nước ép cam tươi", price: 35000, stock: 0, image: "food-ncpcamti.jpg",
        description: "Cam sành vắt tại quầy, không thêm đường. Đang tạm hết hàng." },
    ],
  },
];

const client = new pg.Client({
  connectionString: url,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: true },
});
await client.connect();

try {
  await client.query("BEGIN");

  // Xoa theo dung thu tu khoa ngoai. orders tham chieu users nen khong xoa users
  // o day - seed chi dung ve catalog.
  await client.query("DELETE FROM order_items");
  await client.query("DELETE FROM reviews");
  await client.query("DELETE FROM foods");
  await client.query("DELETE FROM categories");

  let foodCount = 0;
  for (const category of CATEGORIES) {
    const { rows } = await client.query(
      `INSERT INTO categories (name, image) VALUES ($1, $2) RETURNING id`,
      [category.name, category.image]
    );
    const categoryId = rows[0].id;

    for (const food of category.foods) {
      await client.query(
        `INSERT INTO foods (name, description, price, image, category_id, stock, is_available)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [food.name, food.description, food.price, food.image, categoryId,
         food.stock, food.stock > 0]
      );
      foodCount += 1;
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  let adminNote = "khong tao admin (thieu ADMIN_EMAIL/ADMIN_PASSWORD)";

  if (adminEmail && adminPassword) {
    if (adminPassword.length < 6) throw new Error("ADMIN_PASSWORD phai tu 6 ky tu");
    const hash = await bcrypt.hash(adminPassword, 10);
    // Chay seed nhieu lan khong tao trung admin
    await client.query(
      `INSERT INTO users (name, email, password, is_admin)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password, is_admin = true`,
      ["Quan tri FoodGo", adminEmail, hash]
    );
    adminNote = `admin: ${adminEmail}`;
  }

  await client.query("COMMIT");
  console.log(`Seed xong: ${CATEGORIES.length} danh muc, ${foodCount} mon, ${adminNote}`);
  console.log('Mon "Nước ép cam tươi" co stock = 0 de thu luong het hang.');
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Seed that bai:", error.message);
  process.exit(1);
} finally {
  await client.end();
}
