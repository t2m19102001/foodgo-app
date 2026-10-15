package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.AddReviewRequest;
import com.foodgo_app.model.response.EditReviewRequest;
import com.foodgo_app.model.response.ReviewListResponse;
import com.foodgo_app.model.response.ReviewResponse;
import com.foodgo_app.model.response.SimpleResponse;

import retrofit2.Call;

public class ReviewRepository {

    private final ApiService apiService;

    public ReviewRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<ReviewListResponse> getFoodReviews(String foodId) {
        return apiService.getFoodReviews(foodId);
    }

    public Call<ReviewResponse> addReview(String foodId, int rating, String comment) {
        return apiService.addReview(new AddReviewRequest(foodId, rating, comment));
    }

    public Call<ReviewResponse> editReview(String id, int rating, String comment) {
        return apiService.editReview(id, new EditReviewRequest(rating, comment));
    }

    public Call<SimpleResponse> deleteReview(String id) {
        return apiService.deleteReview(id);
    }
}
