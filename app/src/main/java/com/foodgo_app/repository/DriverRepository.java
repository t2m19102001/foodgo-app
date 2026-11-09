package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.OrderListResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.model.response.UpdateDriverLocationRequest;

import retrofit2.Call;

public class DriverRepository {

    private final ApiService apiService;

    public DriverRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<OrderListResponse> getMyDeliveries() {
        return apiService.getMyDeliveries();
    }

    public Call<SimpleResponse> updateMyLocation(double lat, double lng) {
        return apiService.updateMyDriverLocation(new UpdateDriverLocationRequest(lat, lng));
    }
}
