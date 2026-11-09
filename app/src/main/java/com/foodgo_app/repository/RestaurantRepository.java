package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.RestaurantLocationResponse;

import retrofit2.Call;

public class RestaurantRepository {

    private final ApiService apiService;

    public RestaurantRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<RestaurantLocationResponse> getLocation() {
        return apiService.getRestaurantLocation();
    }
}
