package com.foodgo_app.model.response;

import com.foodgo_app.model.Food;

public class FoodDetailResponse {
    private boolean success;
    private String message;
    private Food food;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Food getFood() { return food; }
}
