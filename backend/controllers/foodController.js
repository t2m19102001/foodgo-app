import foodModel from "../models/foodModel.js";
import categoryModel from "../models/categoryModel.js";
import { deleteImageSafe } from "../util/uploadFile.js";
import { findWithOptionalPagination, parseOptionalPagination } from "../util/pagination.js";
import logger from "../util/logger.js";

const validPrice = (price) => price !== null && price !== undefined
  && String(price).trim() !== "" && Number.isFinite(Number(price)) && Number(price) >= 0;

export const addFood = async (req, res) => {
  try {
    const { name, description, price, category } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: "Vui lòng upload ảnh món ăn" });
    }
    if (typeof name !== "string" || !name.trim()
        || typeof category !== "string" || !category.trim()
        || !validPrice(price)) {
      await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }
    if (!await categoryModel.exists({ name: category.trim() })) {
      await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Danh mục không tồn tại" });
    }

    const food = await foodModel.create({
      name: name.trim(),
      description: (description || "").trim(),
      price: Number(price),
      category: category.trim(),
      image: req.file.filename,
    });

    res.status(201).json({ success: true, message: "Thêm món ăn thành công", food });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    logger.error("Add food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm món ăn" });
  }
};

export const listFood = async (req, res) => {
  try {
    const pagination = parseOptionalPagination(req.query);
    if (pagination.invalid) {
      return res.status(400).json({ success: false, message: "Tham số phân trang không hợp lệ" });
    }

    const { items, meta } = await findWithOptionalPagination(foodModel, {}, pagination);
    res.json({ success: true, foods: items, pagination: meta });
  } catch (error) {
    logger.error("List food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách món ăn" });
  }
};

export const getFoodById = async (req, res) => {
  try {
    const food = await foodModel.findById(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
    }
    res.json({ success: true, food });
  } catch (error) {
    logger.error("Get food by id error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy thông tin món ăn" });
  }
};

export const getFoodByCategory = async (req, res) => {
  try {
    const pagination = parseOptionalPagination(req.query);
    if (pagination.invalid) {
      return res.status(400).json({ success: false, message: "Tham số phân trang không hợp lệ" });
    }

    const filter = { category: req.params.category };
    const { items, meta } = await findWithOptionalPagination(foodModel, filter, pagination);
    res.json({ success: true, foods: items, pagination: meta });
  } catch (error) {
    logger.error("Get food by category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy món ăn theo danh mục" });
  }
};

export const updateFood = async (req, res) => {
  try {
    const { name, description, price, category, isAvailable } = req.body;
    if ((name !== undefined && (typeof name !== "string" || !name.trim()))
        || (category !== undefined && (typeof category !== "string" || !category.trim()))
        || (price !== undefined && !validPrice(price))
        || (description !== undefined && typeof description !== "string")
        || (isAvailable !== undefined && !["true", "false"].includes(String(isAvailable)))) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Thông tin món ăn không hợp lệ" });
    }
    if (category !== undefined && !await categoryModel.exists({ name: category.trim() })) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Danh mục không tồn tại" });
    }
    const food = await foodModel.findById(req.params.id);

    if (!food) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
    }

    if (name) food.name = name.trim();
    if (description !== undefined) food.description = description.trim();
    if (price !== undefined) food.price = Number(price);
    if (category) food.category = category.trim();
    if (isAvailable !== undefined) food.isAvailable = String(isAvailable) === "true";

    const oldImage = food.image;
    if (req.file) food.image = req.file.filename;

    await food.save();
    if (req.file && oldImage !== req.file.filename) await deleteImageSafe(oldImage);
    res.json({ success: true, message: "Cập nhật món ăn thành công", food });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    logger.error("Update food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật món ăn" });
  }
};

export const removeFood = async (req, res) => {
  try {
    const food = await foodModel.findByIdAndDelete(req.params.id);
    if (!food) {
      return res.status(404).json({ success: false, message: "Không tìm thấy món ăn" });
    }

    await deleteImageSafe(food.image);

    res.json({ success: true, message: "Xóa món ăn thành công" });
  } catch (error) {
    logger.error("Remove food error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa món ăn" });
  }
};
