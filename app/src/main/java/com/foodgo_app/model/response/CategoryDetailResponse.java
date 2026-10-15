package com.foodgo_app.model.response;

import com.foodgo_app.model.Category;

public class CategoryDetailResponse {
    private boolean success;
    private String message;
    private Category category;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Category getCategory() { return category; }
}
