package com.foodgo_app.ui.order;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.Order;
import com.foodgo_app.model.response.OrderDetailResponse;
import com.foodgo_app.model.response.OrderListResponse;
import com.foodgo_app.repository.OrderRepository;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class OrderViewModel extends AndroidViewModel {

    private static final int LIMIT = 10;

    private final OrderRepository orderRepository;

    private final MutableLiveData<List<Order>> orders = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<Order> orderDetail = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> cancelSuccess = new MutableLiveData<>();
    private final MutableLiveData<Boolean> hasMore = new MutableLiveData<>(true);

    private final List<Order> accumulatedOrders = new ArrayList<>();
    private int currentPage = 0;
    private int generation = 0;
    private boolean isLoadingMore = false;
    private String statusFilter = null;

    public OrderViewModel(@NonNull Application application) {
        super(application);
        orderRepository = new OrderRepository(application);
    }

    public LiveData<List<Order>> getOrders() { return orders; }
    public LiveData<Order> getOrderDetail() { return orderDetail; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }
    public LiveData<Boolean> getCancelSuccess() { return cancelSuccess; }
    public LiveData<Boolean> getHasMore() { return hasMore; }

    @Nullable
    public String getStatusFilter() { return statusFilter; }

    // status = null nghia la xem tat ca trang thai
    public void setStatusFilter(@Nullable String status) {
        this.statusFilter = status;
        refreshOrders();
    }

    public void refreshOrders() {
        generation++;
        currentPage = 0;
        isLoadingMore = false;
        accumulatedOrders.clear();
        orders.setValue(new ArrayList<>());
        hasMore.setValue(true);
        loadOrders(1);
    }

    public void loadMoreOrders() {
        if (isLoadingMore || Boolean.FALSE.equals(hasMore.getValue())) {
            return;
        }
        loadOrders(currentPage + 1);
    }

    private void loadOrders(int requestedPage) {
        final int requestedGeneration = generation;
        final String requestedFilter = statusFilter;
        isLoadingMore = true;
        loading.setValue(true);
        orderRepository.getMyOrders(requestedPage, LIMIT, requestedFilter).enqueue(new Callback<OrderListResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderListResponse> call, @NonNull Response<OrderListResponse> response) {
                if (requestedGeneration != generation) return;
                loading.setValue(false);
                isLoadingMore = false;
                OrderListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    currentPage = requestedPage;
                    List<Order> page = body.getOrders() != null ? body.getOrders() : new ArrayList<>();
                    accumulatedOrders.addAll(page);
                    orders.setValue(new ArrayList<>(accumulatedOrders));
                    if (body.getPagination() != null) {
                        hasMore.setValue(requestedPage < body.getPagination().getTotalPages());
                    } else {
                        hasMore.setValue(!page.isEmpty());
                    }
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải danh sách đơn hàng"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderListResponse> call, @NonNull Throwable t) {
                if (requestedGeneration != generation) return;
                loading.setValue(false);
                isLoadingMore = false;
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void loadOrderDetail(String orderId) {
        orderRepository.getOrderById(orderId).enqueue(new Callback<OrderDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderDetailResponse> call, @NonNull Response<OrderDetailResponse> response) {
                OrderDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    orderDetail.setValue(body.getOrder());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải thông tin đơn hàng"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderDetailResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void cancelOrder(String orderId, String reason) {
        loading.setValue(true);
        orderRepository.cancelOrder(orderId, reason).enqueue(new Callback<OrderDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderDetailResponse> call, @NonNull Response<OrderDetailResponse> response) {
                loading.setValue(false);
                OrderDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    orderDetail.setValue(body.getOrder());
                    cancelSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể hủy đơn hàng"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }
}
