package com.foodgo_app.repository;

import android.content.Context;

import androidx.annotation.Nullable;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.FoodDetailResponse;
import com.foodgo_app.model.response.FoodListResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.util.MultipartUtils;

import okhttp3.MultipartBody;
import retrofit2.Call;

public class FoodRepository {

    private final ApiService apiService;

    public FoodRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<FoodListResponse> getFoodList() {
        return apiService.getFoodList();
    }

    public Call<FoodDetailResponse> getFoodById(String id) {
        return apiService.getFoodById(id);
    }

    public Call<FoodListResponse> getFoodByCategory(String category) {
        return apiService.getFoodByCategory(category);
    }

    // ===== Danh cho admin =====
    public Call<FoodDetailResponse> createFood(String name, String description, String price,
                                                String category, MultipartBody.Part image) {
        return apiService.createFood(
                MultipartUtils.textPart(name),
                MultipartUtils.textPart(description),
                MultipartUtils.textPart(price),
                MultipartUtils.textPart(category),
                image
        );
    }

    public Call<FoodDetailResponse> updateFood(String id, String name, String description, String price,
                                                String category, boolean isAvailable,
                                                @Nullable MultipartBody.Part image) {
        return apiService.updateFood(
                id,
                MultipartUtils.textPart(name),
                MultipartUtils.textPart(description),
                MultipartUtils.textPart(price),
                MultipartUtils.textPart(category),
                MultipartUtils.textPart(String.valueOf(isAvailable)),
                image
        );
    }

    public Call<SimpleResponse> deleteFood(String id) {
        return apiService.deleteFood(id);
    }
}
