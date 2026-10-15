package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.NotificationListResponse;
import com.foodgo_app.model.response.SimpleResponse;

import retrofit2.Call;

public class NotificationRepository {

    private final ApiService apiService;

    public NotificationRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<NotificationListResponse> getNotifications() {
        return apiService.getNotifications();
    }

    public Call<SimpleResponse> markAsRead(String id) {
        return apiService.markNotificationRead(id);
    }

    public Call<SimpleResponse> markAllAsRead() {
        return apiService.markAllNotificationsRead();
    }
}
