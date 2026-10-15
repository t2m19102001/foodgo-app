import categoryModel from "../models/categoryModel.js";
import foodModel from "../models/foodModel.js";
import { deleteImageSafe } from "../util/uploadFile.js";

export const addCategory = async (req, res) => {
  try {
    const { name } = req.body;
    if (typeof name !== "string" || !name.trim()) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Vui lòng nhập tên danh mục" });
    }

    const category = await categoryModel.create({
      name: name.trim(),
      image: req.file ? req.file.filename : "",
    });

    res.status(201).json({ success: true, message: "Thêm danh mục thành công", category });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    console.error("Add category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi thêm danh mục" });
  }
};

export const listCategories = async (req, res) => {
  try {
    const categories = await categoryModel.find({});
    res.json({ success: true, categories });
  } catch (error) {
    console.error("List categories error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách danh mục" });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { name } = req.body;
    const category = await categoryModel.findById(req.params.id);

    if (!category) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(400).json({ success: false, message: "Tên danh mục không hợp lệ" });
    }
    if (name && name.trim() !== category.name
        && await foodModel.exists({ category: category.name })) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(409).json({ success: false, message: "Hãy chuyển các món sang danh mục khác trước khi đổi tên" });
    }
    if (name) category.name = name.trim();
    const oldImage = category.image;
    if (req.file) category.image = req.file.filename;

    await category.save();
    if (req.file && oldImage !== req.file.filename) await deleteImageSafe(oldImage);
    res.json({ success: true, message: "Cập nhật danh mục thành công", category });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    console.error("Update category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật danh mục" });
  }
};

export const removeCategory = async (req, res) => {
  try {
    const category = await categoryModel.findById(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: "Không tìm thấy danh mục" });
    }
    if (await foodModel.exists({ category: category.name })) {
      return res.status(409).json({ success: false, message: "Không thể xóa danh mục đang có món" });
    }
    await categoryModel.findByIdAndDelete(req.params.id);
    await deleteImageSafe(category.image);
    res.json({ success: true, message: "Xóa danh mục thành công" });
  } catch (error) {
    console.error("Remove category error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa danh mục" });
  }
};
