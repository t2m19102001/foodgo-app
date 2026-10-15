package com.foodgo_app.model.response;

import com.foodgo_app.model.Food;

import java.util.List;

public class FoodListResponse {
    private boolean success;
    private String message;
    private List<Food> foods;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<Food> getFoods() { return foods; }
}
