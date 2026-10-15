import multer from "multer";
import path from "path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { uploadsDir, deleteImageSafe } from "../util/uploadFile.js";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, randomUUID() + path.extname(file.originalname).toLowerCase());
  },
});

const allowedExts = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Định dạng ảnh không hợp lệ"));
  }
};

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const handleUploadError = (err, req, res, next) => {
  if (err) {
    return res.status(400).json({ success: false, message: err.message || "Lỗi upload ảnh" });
  }
  next();
};

export const isSupportedImage = (bytes, extension) => {
  if (extension === ".jpg" || extension === ".jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (extension === ".png") {
    return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (extension === ".gif") {
    const header = bytes.toString("ascii", 0, 6);
    return header === "GIF87a" || header === "GIF89a";
  }
  if (extension === ".webp") {
    return bytes.toString("ascii", 0, 4) === "RIFF"
      && bytes.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
};

export const validateUploadedImage = async (req, res, next) => {
  if (!req.file) return next();
  try {
    const handle = await fs.open(req.file.path, "r");
    const bytes = Buffer.alloc(12);
    try {
      await handle.read(bytes, 0, bytes.length, 0);
    } finally {
      await handle.close();
    }
    if (isSupportedImage(bytes, path.extname(req.file.filename).toLowerCase())) return next();
  } catch (error) {
    console.error("Validate upload error:", error);
  }
  await deleteImageSafe(req.file.filename);
  res.status(400).json({ success: false, message: "Nội dung ảnh không hợp lệ" });
};
