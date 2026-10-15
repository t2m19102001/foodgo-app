import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import validator from "validator";
import userModel from "../models/userModel.js";
import { deleteImageSafe } from "../util/uploadFile.js";

const createToken = (id, isAdmin = false, tokenVersion = 0) => {
  return jwt.sign({ id, isAdmin, tokenVersion }, process.env.JWT_SECRET, { expiresIn: "7d" });
};

export const registerUser = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng điền đầy đủ thông tin" });
    }
    if (!validator.isEmail(email)) {
      return res.status(400).json({ success: false, message: "Email không hợp lệ" });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu tối thiểu 6 ký tự" });
    }

    const exists = await userModel.findOne({ email: email.toLowerCase().trim() });
    if (exists) {
      return res.status(400).json({ success: false, message: "Email đã được sử dụng" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await userModel.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      phone: phone || "",
    });

    const token = createToken(newUser._id, newUser.isAdmin, newUser.tokenVersion);

    res.status(201).json({
      success: true,
      message: "Đăng ký thành công",
      token,
      userId: newUser._id,
      name: newUser.name,
      isAdmin: newUser.isAdmin,
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi đăng ký" });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập email và mật khẩu" });
    }

    const user = await userModel.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: "Email không tồn tại" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "Mật khẩu không đúng" });
    }
    if (!user.isActive) {
      return res.status(403).json({ success: false, message: "Tài khoản đã bị khóa" });
    }

    const token = createToken(user._id, user.isAdmin, user.tokenVersion);

    res.json({
      success: true,
      message: "Đăng nhập thành công",
      token,
      userId: user._id,
      isAdmin: user.isAdmin,
      name: user.name,
      image: user.image || "",
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi đăng nhập" });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await userModel.findById(req.userId).select("-password");
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }
    res.json({ success: true, user });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi tải thông tin cá nhân" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const { name, phone, address } = req.body;
    const updateData = {};

    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone;
    if (address !== undefined) updateData.address = address;
    if (req.file) updateData.image = req.file.filename;

    const oldUser = req.file ? await userModel.findById(req.userId).select("image") : null;
    const updatedUser = await userModel
      .findByIdAndUpdate(req.userId, updateData, { new: true, runValidators: true })
      .select("-password");

    if (!updatedUser) {
      if (req.file) await deleteImageSafe(req.file.filename);
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    if (req.file && oldUser?.image && oldUser.image !== req.file.filename) {
      await deleteImageSafe(oldUser.image);
    }

    res.json({ success: true, message: "Cập nhật thông tin thành công", user: updatedUser });
  } catch (error) {
    if (req.file) await deleteImageSafe(req.file.filename);
    console.error("Update profile error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật thông tin" });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "Vui lòng nhập đầy đủ thông tin" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "Mật khẩu mới tối thiểu 6 ký tự" });
    }

    const user = await userModel.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "Không tìm thấy người dùng" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Mật khẩu cũ không chính xác" });
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    res.json({ success: true, message: "Đổi mật khẩu thành công" });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ success: false, message: "Lỗi hệ thống khi đổi mật khẩu" });
  }
};
