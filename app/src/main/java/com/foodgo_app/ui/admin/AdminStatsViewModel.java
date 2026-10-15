package com.foodgo_app.ui.admin;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.response.OrderStatsResponse;
import com.foodgo_app.repository.OrderRepository;
import com.foodgo_app.util.ApiErrorUtils;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AdminStatsViewModel extends AndroidViewModel {

    private final OrderRepository orderRepository;

    private final MutableLiveData<OrderStatsResponse> stats = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();

    public AdminStatsViewModel(@NonNull Application application) {
        super(application);
        orderRepository = new OrderRepository(application);
    }

    public LiveData<OrderStatsResponse> getStats() { return stats; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    public void clearError() { error.setValue(null); }

    public void refresh() {
        loading.setValue(true);
        orderRepository.getOrderStats().enqueue(new Callback<OrderStatsResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderStatsResponse> call, @NonNull Response<OrderStatsResponse> response) {
                loading.setValue(false);
                OrderStatsResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    stats.setValue(body);
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể tải thống kê"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderStatsResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }
}
