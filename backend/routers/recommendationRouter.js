import express from "express";
import { getHomeRecommendations } from "../controllers/recommendationController.js";
import { authMiddleware } from "../middleware/auth.js";

const recommendationRouter = express.Router();

recommendationRouter.get("/home", authMiddleware, getHomeRecommendations);

export default recommendationRouter;
