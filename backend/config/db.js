import mongoose from "mongoose";
import logger from "../util/logger.js";

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info("MongoDB connected");
  } catch (error) {
    logger.error("MongoDB connection error:", error.message);
    process.exit(1);
  }
};
