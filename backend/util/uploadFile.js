import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import logger from "./logger.js";

export const uploadsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../uploads");

export const deleteImageSafe = async (filename) => {
  if (!filename || path.basename(filename) !== filename) return;
  try {
    await fs.unlink(path.join(uploadsDir, filename));
  } catch (error) {
    if (error.code !== "ENOENT") logger.error("Delete upload error:", error);
  }
};
