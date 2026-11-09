package com.foodgo_app.ui.driver;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.Order;
import com.foodgo_app.model.response.OrderListResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.repository.DriverRepository;
import com.foodgo_app.util.ApiErrorUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class DriverOrdersViewModel extends AndroidViewModel {

    private final DriverRepository driverRepository;

    private final MutableLiveData<List<Order>> orders = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();

    public DriverOrdersViewModel(@NonNull Application application) {
        super(application);
        driverRepository = new DriverRepository(application);
    }

    public LiveData<List<Order>> getOrders() { return orders; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    public void clearError() { error.setValue(null); }

    public void loadMyDeliveries() {
        loading.setValue(true);
        driverRepository.getMyDeliveries().enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderListResponse> call, @NonNull Response<OrderListResponse> response) {
                loading.setValue(false);
                OrderListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    orders.setValue(body.getOrders() != null ? body.getOrders() : new ArrayList<>());
                } else {
                    error.setValue(ApiErrorUtils.getMessage(response, "Không thể tải danh sách đơn đang giao"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderListResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    // Goi am tham moi 10s khi bat chia se vi tri - khong bao loi ra UI de
    // tranh spam Toast neu mang chap chon, chi ghi log.
    public void updateLocation(double lat, double lng) {
        driverRepository.updateMyLocation(lat, lng).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                // Khong can xu ly gi them, chi la cap nhat am tham
            }

            @Override
            public void onFailure(@NonNull Call<SimpleResponse> call, @NonNull Throwable t) {
                // Bo qua loi tam thoi, lan goi tiep theo sau 10s se thu lai
            }
        });
    }
}
