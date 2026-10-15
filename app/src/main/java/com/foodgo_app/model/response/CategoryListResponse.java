package com.foodgo_app.model.response;

import com.foodgo_app.model.Category;

import java.util.List;

public class CategoryListResponse {
    private boolean success;
    private String message;
    private List<Category> categories;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<Category> getCategories() { return categories; }
}
