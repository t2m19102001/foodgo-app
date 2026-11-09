package com.foodgo_app.model.response;

import com.foodgo_app.model.Food;

import java.util.List;

public class AiSearchResponse {
    private boolean success;
    private String message;
    private List<Food> foods;
    // Cac tieu chi khach nhac toi nhung FoodGo CHUA ho tro (vd "promotion",
    // "distance") - xem backend/util/searchIntent.js. Hien thi minh bach cho
    // khach thay vi am tham bo qua.
    private List<String> unsupported;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<Food> getFoods() { return foods; }
    public List<String> getUnsupported() { return unsupported; }
}
