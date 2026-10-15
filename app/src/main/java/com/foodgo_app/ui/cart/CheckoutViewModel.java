package com.foodgo_app.ui.cart;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.Address;
import com.foodgo_app.model.CartItem;
import com.foodgo_app.model.OrderItem;
import com.foodgo_app.model.SavedAddress;
import com.foodgo_app.model.response.AddressListResponse;
import com.foodgo_app.model.response.OrderDetailResponse;
import com.foodgo_app.model.response.PlaceOrderRequest;
import com.foodgo_app.model.response.VnpayCreateResponse;
import com.foodgo_app.repository.AddressRepository;
import com.foodgo_app.repository.CartRepository;
import com.foodgo_app.repository.OrderRepository;
import com.foodgo_app.util.SessionManager;
import com.google.gson.Gson;
import com.google.gson.JsonSyntaxException;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class CheckoutViewModel extends AndroidViewModel {

    private final CartRepository cartRepository;
    private final OrderRepository orderRepository;
    private final AddressRepository addressRepository;
    private final SharedPreferences pendingPrefs;
    private final String pendingKey;
    private final Gson gson = new Gson();

    private final MutableLiveData<List<CartItem>> cartItems = new MutableLiveData<>();
    private final MutableLiveData<Double> totalAmount = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<String> placedOrderId = new MutableLiveData<>();
    private final MutableLiveData<Boolean> hasPendingOrder = new MutableLiveData<>(false);
    private final MutableLiveData<String> vnpayPayUrl = new MutableLiveData<>();
    private final MutableLiveData<List<SavedAddress>> addresses = new MutableLiveData<>();
    private final MutableLiveData<SavedAddress> selectedAddress = new MutableLiveData<>();

    public CheckoutViewModel(@NonNull Application application) {
        super(application);
        cartRepository = new CartRepository(application);
        orderRepository = new OrderRepository(application);
        addressRepository = new AddressRepository(application);
        pendingPrefs = application.getSharedPreferences("delivery_app_checkout", Context.MODE_PRIVATE);
        String userId = new SessionManager(application).getUserId();
        pendingKey = "pending_" + (userId != null ? userId : "guest");
        hasPendingOrder.setValue(pendingPrefs.contains(pendingKey));
        cartItems.setValue(cartRepository.getCartItems());
        totalAmount.setValue(cartRepository.getTotalAmount());
        loadAddresses();
    }

    public LiveData<List<CartItem>> getCartItems() { return cartItems; }
    public LiveData<Double> getTotalAmount() { return totalAmount; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }
    public LiveData<String> getPlacedOrderId() { return placedOrderId; }
    public LiveData<Boolean> getHasPendingOrder() { return hasPendingOrder; }
    public LiveData<String> getVnpayPayUrl() { return vnpayPayUrl; }
    public void clearVnpayPayUrl() { vnpayPayUrl.setValue(null); }
    public LiveData<SavedAddress> getSelectedAddress() { return selectedAddress; }

    public void loadAddresses() {
        addressRepository.getMyAddresses().enqueue(new Callback<AddressListResponse>() {
            @Override
            public void onResponse(@NonNull Call<AddressListResponse> call, @NonNull Response<AddressListResponse> response) {
                AddressListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    List<SavedAddress> list = body.getAddresses() != null ? body.getAddresses() : new ArrayList<>();
                    addresses.setValue(list);
                    SavedAddress currentlySelected = selectedAddress.getValue();
                    // Giu lai lua chon hien tai neu con trong danh sach, khong thi lay dia chi mac dinh (hoac dau tien)
                    SavedAddress next = find(list, currentlySelected != null ? currentlySelected.getId() : null);
                    if (next == null) next = findDefault(list);
                    selectedAddress.setValue(next);
                } else {
                    error.setValue(ApiErrorUtils.getMessage(response, "Không thể tải địa chỉ giao hàng"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<AddressListResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void selectAddress(String addressId) {
        SavedAddress found = find(addresses.getValue(), addressId);
        if (found != null) selectedAddress.setValue(found);
    }

    private static SavedAddress find(List<SavedAddress> list, String id) {
        if (list == null || id == null) return null;
        for (SavedAddress address : list) {
            if (id.equals(address.getId())) return address;
        }
        return null;
    }

    private static SavedAddress findDefault(List<SavedAddress> list) {
        if (list == null || list.isEmpty()) return null;
        for (SavedAddress address : list) {
            if (address.isDefault()) return address;
        }
        return list.get(0);
    }

    public void placeOrder(String paymentMethod) {
        if (Boolean.TRUE.equals(loading.getValue())) return;
        String saved = pendingPrefs.getString(pendingKey, null);
        if (saved != null) {
            PlaceOrderRequest pending;
            try {
                pending = gson.fromJson(saved, PlaceOrderRequest.class);
            } catch (JsonSyntaxException exception) {
                pending = null;
            }
            if (pending != null && pending.getClientRequestId() != null
                    && pending.getItems() != null && !pending.getItems().isEmpty()) {
                checkPendingOrder(pending);
                return;
            }
            clearPending();
        }
        List<CartItem> items = cartItems.getValue();
        if (items == null || items.isEmpty()) {
            error.setValue("Giỏ hàng trống");
            return;
        }
        SavedAddress savedAddress = selectedAddress.getValue();
        if (savedAddress == null) {
            error.setValue("Vui lòng chọn hoặc thêm địa chỉ giao hàng");
            return;
        }

        List<OrderItem> orderItems = new ArrayList<>();
        for (CartItem item : items) {
            orderItems.add(new OrderItem(
                    item.getFood().getId(),
                    item.getFood().getName(),
                    item.getFood().getPrice(),
                    item.getQuantity(),
                    item.getFood().getImage()
            ));
        }
        Address address = new Address(savedAddress.getFullName(), savedAddress.getPhone(),
                savedAddress.getAddress(), savedAddress.getNote());
        double amount = cartRepository.getTotalAmount();
        PlaceOrderRequest request = new PlaceOrderRequest(orderItems, amount, address,
                UUID.randomUUID().toString(), paymentMethod);
        if (!pendingPrefs.edit().putString(pendingKey, gson.toJson(request)).commit()) {
            error.setValue("Không thể lưu yêu cầu đặt hàng trên thiết bị. Vui lòng thử lại.");
            return;
        }
        hasPendingOrder.setValue(true);
        submitOrder(request);
    }

    private void checkPendingOrder(PlaceOrderRequest request) {
        loading.setValue(true);
        orderRepository.getOrderByRequestId(request.getClientRequestId()).enqueue(new Callback<OrderDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderDetailResponse> call, @NonNull Response<OrderDetailResponse> response) {
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    completeOrder(response.body(), request);
                } else if (response.code() == 404) {
                    submitOrder(request);
                } else {
                    loading.setValue(false);
                    error.setValue(ApiErrorUtils.getMessage(response, "Không thể kiểm tra đơn hàng, vui lòng thử lại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Chưa xác định được đơn hàng. Vui lòng kiểm tra mạng rồi thử lại.");
            }
        });
    }

    private void submitOrder(PlaceOrderRequest request) {
        loading.setValue(true);
        orderRepository.placeOrder(request).enqueue(new Callback<OrderDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderDetailResponse> call, @NonNull Response<OrderDetailResponse> response) {
                loading.setValue(false);
                OrderDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    completeOrder(body, request);
                } else {
                    if (response.code() >= 400 && response.code() < 500 && response.code() != 408
                            && response.code() != 429) clearPending();
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Đặt hàng thất bại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Chưa xác định được đơn hàng. Bấm kiểm tra / thử lại khi có mạng.");
            }
        });
    }

    private void completeOrder(OrderDetailResponse body, PlaceOrderRequest request) {
        String orderId = body.getOrderId();
        if (orderId == null && body.getOrder() != null) orderId = body.getOrder().getId();
        if (orderId == null || orderId.isEmpty()) {
            loading.setValue(false);
            error.setValue("Server chưa trả mã đơn hàng. Vui lòng kiểm tra lại.");
            return;
        }
        clearPending();
        cartRepository.removeOrderedItems(request.getItems());
        if ("vnpay".equals(request.getPaymentMethod())) {
            createVnpayPayment(orderId);
        } else {
            loading.setValue(false);
            placedOrderId.setValue(orderId);
        }
    }

    // Don da tao xong (COD hoac VNPay), chi con thieu buoc lay link thanh toan VNPay.
    // Du thanh cong hay khong van chuyen sang man theo doi don vi don da ton tai tren server.
    private void createVnpayPayment(String orderId) {
        String finalOrderId = orderId;
        orderRepository.createVnpayPayment(orderId).enqueue(new Callback<VnpayCreateResponse>() {
            @Override
            public void onResponse(@NonNull Call<VnpayCreateResponse> call, @NonNull Response<VnpayCreateResponse> response) {
                loading.setValue(false);
                VnpayCreateResponse body = response.body();
                // Chuyen sang man theo doi don TRUOC (don da clear task) de khi mo trinh duyet
                // VNPay ngay sau, trinh duyet khong bi "cuon" theo flag CLEAR_TASK cua buoc nay
                placedOrderId.setValue(finalOrderId);
                if (response.isSuccessful() && body != null && body.isSuccess() && body.getPayUrl() != null) {
                    vnpayPayUrl.setValue(body.getPayUrl());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tạo thanh toán VNPay"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<VnpayCreateResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                placedOrderId.setValue(finalOrderId);
                error.setValue("Không thể tạo thanh toán VNPay. Vui lòng kiểm tra mạng rồi thử lại sau.");
            }
        });
    }

    private void clearPending() {
        pendingPrefs.edit().remove(pendingKey).apply();
        hasPendingOrder.setValue(false);
    }
}
