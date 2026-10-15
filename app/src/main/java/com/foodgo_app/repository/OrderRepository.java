package com.foodgo_app.repository;

import android.content.Context;

import androidx.annotation.Nullable;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.Address;
import com.foodgo_app.model.OrderItem;
import com.foodgo_app.model.response.CancelOrderRequest;
import com.foodgo_app.model.response.OrderDetailResponse;
import com.foodgo_app.model.response.OrderListResponse;
import com.foodgo_app.model.response.OrderStatsResponse;
import com.foodgo_app.model.response.PlaceOrderRequest;
import com.foodgo_app.model.response.UpdateStatusRequest;
import com.foodgo_app.model.response.VnpayCreateResponse;

import java.util.List;

import retrofit2.Call;

public class OrderRepository {

    private final ApiService apiService;

    public OrderRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<OrderDetailResponse> placeOrder(PlaceOrderRequest request) {
        return apiService.placeOrder(request);
    }

    public Call<OrderDetailResponse> getOrderByRequestId(String clientRequestId) {
        return apiService.getOrderByRequestId(clientRequestId);
    }

    public Call<OrderListResponse> getMyOrders(int page, int limit, @Nullable String status) {
        return apiService.getMyOrders(page, limit, status);
    }

    public Call<OrderDetailResponse> getOrderById(String id) {
        return apiService.getOrderById(id);
    }

    public Call<OrderDetailResponse> cancelOrder(String id, String reason) {
        return apiService.cancelOrder(id, new CancelOrderRequest(reason));
    }

    public Call<VnpayCreateResponse> createVnpayPayment(String orderId) {
        return apiService.createVnpayPayment(orderId);
    }

    // ===== Danh cho admin =====
    public Call<OrderListResponse> getAllOrders(int page, int limit, @Nullable String status) {
        return apiService.getAllOrders(page, limit, status);
    }

    public Call<OrderDetailResponse> updateOrderStatus(String id, String status) {
        return apiService.updateOrderStatus(id, new UpdateStatusRequest(status));
    }

    public Call<OrderStatsResponse> getOrderStats() {
        return apiService.getOrderStats();
    }
}
