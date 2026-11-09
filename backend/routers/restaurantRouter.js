import express from "express";
import { getRestaurantLocation } from "../controllers/restaurantController.js";

const restaurantRouter = express.Router();

restaurantRouter.get("/location", getRestaurantLocation);

export default restaurantRouter;
