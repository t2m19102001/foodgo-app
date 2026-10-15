package com.foodgo_app.repository;

import android.content.Context;

import androidx.annotation.Nullable;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.CategoryDetailResponse;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.util.MultipartUtils;

import okhttp3.MultipartBody;
import retrofit2.Call;

public class CategoryRepository {

    private final ApiService apiService;

    public CategoryRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<CategoryListResponse> getCategoryList() {
        return apiService.getCategoryList();
    }

    // ===== Danh cho admin =====
    public Call<CategoryDetailResponse> createCategory(String name, @Nullable MultipartBody.Part image) {
        return apiService.createCategory(MultipartUtils.textPart(name), image);
    }

    public Call<CategoryDetailResponse> updateCategory(String id, String name, @Nullable MultipartBody.Part image) {
        return apiService.updateCategory(id, MultipartUtils.textPart(name), image);
    }

    public Call<SimpleResponse> deleteCategory(String id) {
        return apiService.deleteCategory(id);
    }
}
