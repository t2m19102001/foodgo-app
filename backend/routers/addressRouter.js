import express from "express";
import {
  getMyAddresses,
  addAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
} from "../controllers/addressController.js";
import { authMiddleware } from "../middleware/auth.js";

const addressRouter = express.Router();

addressRouter.get("/", authMiddleware, getMyAddresses);
addressRouter.post("/", authMiddleware, addAddress);
addressRouter.put("/:id/default", authMiddleware, setDefaultAddress);
addressRouter.put("/:id", authMiddleware, updateAddress);
addressRouter.delete("/:id", authMiddleware, deleteAddress);

export default addressRouter;
