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
    // placedOrderId chi duoc set khi don THAT SU da duoc dat: COD ngay luc tao,
    // hoac VNPay sau khi da thanh toan thanh cong (qua checkPendingOrder, xem
    // ghi chu o submitOrder). Voi VNPay chua tra tien, server khong tra ve
    // orderId/order nen khong co gi de dieu huong toi ca - chi mo payUrl.
    private final MutableLiveData<String> placedOrderId = new MutableLiveData<>();
    private final MutableLiveData<Boolean> hasPendingOrder = new MutableLiveData<>(false);
    // Dung chung cho VNPay va ZaloPay - ca hai deu tra ve cung field "payUrl"
    // trong response (xem OrderDetailResponse), Android khong can biet khac biet.
    private final MutableLiveData<String> pendingPayUrl = new MutableLiveData<>();
    // Trang thai thanh toan dang cho, hien duoi tong tien (null = an)
    private final MutableLiveData<String> pendingStatus = new MutableLiveData<>();
    // payUrl con han de mo lai trang thanh toan (null = an nut)
    private final MutableLiveData<String> resumePayUrl = new MutableLiveData<>();
    // Thong bao trung tinh (khong phai loi), hien bang Toast
    private final MutableLiveData<String> info = new MutableLiveData<>();
    private final MutableLiveData<List<SavedAddress>> addresses = new MutableLiveData<>();
    private final MutableLiveData<SavedAddress> selectedAddress = new MutableLiveData<>();

    public CheckoutViewModel(@NonNull Application application) {
        this(application, new CartRepository(application), new OrderRepository(application),
                new AddressRepository(application));
    }

    // Package-private: dung de inject repository gia trong unit test (xem
    // app/src/test/java/com/foodgo_app/ui/cart/CheckoutViewModelTest.java),
    // khong dung o production - ViewModelProvider chi goi constructor 1 tham so.
    CheckoutViewModel(@NonNull Application application, CartRepository cartRepository,
                       OrderRepository orderRepository, AddressRepository addressRepository) {
        super(application);
        this.cartRepository = cartRepository;
        this.orderRepository = orderRepository;
        this.addressRepository = addressRepository;
        pendingPrefs = application.getSharedPreferences("delivery_app_checkout", Context.MODE_PRIVATE);
        pendingKey = pendingKeyFor(application);
        hasPendingOrder.setValue(pendingPrefs.contains(pendingKey));
        cartItems.setValue(cartRepository.getCartItems());
        totalAmount.setValue(cartRepository.getTotalAmount());
        loadAddresses();
    }

    private static String pendingKeyFor(Context context) {
        String userId = new SessionManager(context).getUserId();
        return "pending_" + (userId != null ? userId : "guest");
    }

    // Dung o CartActivity: con yeu cau dat hang dang cho (vi du don VNPay chua
    // thanh toan) thi van cho vao Checkout de kiem tra / huy, du gio dang trong.
    public static boolean hasPendingOrder(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("delivery_app_checkout", Context.MODE_PRIVATE);
        return prefs.contains(pendingKeyFor(context));
    }

    public LiveData<List<CartItem>> getCartItems() { return cartItems; }
    public LiveData<Double> getTotalAmount() { return totalAmount; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }
    public LiveData<String> getPlacedOrderId() { return placedOrderId; }
    public LiveData<Boolean> getHasPendingOrder() { return hasPendingOrder; }
    public LiveData<String> getPendingPayUrl() { return pendingPayUrl; }
    public void clearPendingPayUrl() { pendingPayUrl.setValue(null); }
    public LiveData<String> getPendingStatus() { return pendingStatus; }
    public LiveData<String> getResumePayUrl() { return resumePayUrl; }
    public LiveData<String> getInfo() { return info; }
    public void clearInfo() { info.setValue(null); }
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
        PlaceOrderRequest pending = readPending();
        if (pending != null) {
            // Nguoi dung bam "Kiem tra / thanh toan lai": duoc phep tu gui lai don
            checkPendingOrder(pending, true);
            return;
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
                savedAddress.getAddress(), savedAddress.getNote(), savedAddress.getLat(), savedAddress.getLng());
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

    // Goi khi nguoi dung quay lai man Checkout tu trinh duyet VNPay: chi xem
    // trang thai, KHONG tu gui lai don va KHONG tu mo lai VNPay.
    public void refreshPendingStatus() {
        if (Boolean.TRUE.equals(loading.getValue())) return;
        PlaceOrderRequest pending = readPending();
        if (pending != null) checkPendingOrder(pending, false);
    }

    // Bo thanh toan VNPay dang cho de doi phuong thuc / doi gio. Server huy don
    // dang giu cho va tra lai ton kho; gio hang van con nguyen tren may.
    public void abandonPendingOrder() {
        if (Boolean.TRUE.equals(loading.getValue())) return;
        PlaceOrderRequest pending = readPending();
        if (pending == null) {
            clearPending();
            return;
        }
        loading.setValue(true);
        orderRepository.abandonPendingPayment(pending.getClientRequestId()).enqueue(new Callback<OrderDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderDetailResponse> call, @NonNull Response<OrderDetailResponse> response) {
                if (response.isSuccessful() || response.code() == 404) {
                    // 404: yeu cau chua tung toi server, chi can xoa o may
                    loading.setValue(false);
                    clearPending();
                    info.setValue("Đã hủy thanh toán. Bạn có thể chọn phương thức khác.");
                    return;
                }
                if (response.code() == 409) {
                    // Don da ton tai that (da tra tien xong hoac la don COD)
                    OrderDetailResponse body = ApiErrorUtils.parseErrorBody(response, OrderDetailResponse.class);
                    if (body != null && (body.getOrderId() != null || body.getOrder() != null)) {
                        completeOrder(body, pending);
                        return;
                    }
                }
                loading.setValue(false);
                error.setValue(ApiErrorUtils.getMessage(response, "Không thể hủy thanh toán, vui lòng thử lại"));
            }

            @Override
            public void onFailure(@NonNull Call<OrderDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server. Vui lòng thử lại khi có mạng.");
            }
        });
    }

    // userInitiated = true: nguoi dung bam nut, duoc phep gui lai don (khi yeu
    // cau chua toi server, hoac de lay payUrl moi sau lan thanh toan that bai).
    private void checkPendingOrder(PlaceOrderRequest request, boolean userInitiated) {
        loading.setValue(true);
        orderRepository.getOrderByRequestId(request.getClientRequestId()).enqueue(new Callback<OrderDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderDetailResponse> call, @NonNull Response<OrderDetailResponse> response) {
                OrderDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    if (body.isPaymentPending()) {
                        handlePaymentPending(body, request, userInitiated);
                    } else {
                        completeOrder(body, request);
                    }
                    return;
                }
                if (response.code() == 404 && userInitiated) {
                    // Yeu cau dat hang chua toi server (mat mang luc gui): gui lai
                    submitOrder(request);
                    return;
                }
                loading.setValue(false);
                if (response.code() == 410) {
                    // Phien VNPay het han / da huy: server da tra lai ton kho
                    clearPending();
                }
                if (response.code() != 404) {
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

    private void handlePaymentPending(OrderDetailResponse body, PlaceOrderRequest request, boolean userInitiated) {
        boolean failed = "failed".equals(body.getPaymentStatus());
        if (failed && userInitiated) {
            // Lan truoc that bai, nguoi dung bam "thanh toan lai": server cap
            // lan thanh toan moi va ta mo VNPay ngay
            submitOrder(request);
            return;
        }
        loading.setValue(false);
        pendingStatus.setValue(body.getMessage());
        // Khong tu mo lai trang thanh toan: khach co the vua tra tien xong va
        // callback chua ve. Chi hien nut "Mo lai trang thanh toan" voi payUrl cu
        // (cung txnRef/app_trans_id nen cong thanh toan khong cho tra hai lan).
        resumePayUrl.setValue(failed ? null : body.getPayUrl());
    }

    private void submitOrder(PlaceOrderRequest request) {
        loading.setValue(true);
        orderRepository.placeOrder(request).enqueue(new Callback<OrderDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<OrderDetailResponse> call, @NonNull Response<OrderDetailResponse> response) {
                loading.setValue(false);
                OrderDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    if (body.getPayUrl() != null && !body.getPayUrl().isEmpty()) {
                        // Don VNPay/ZaloPay CHUA thanh toan: server khong tra orderId.
                        // Giu nguyen gio hang (chi xoa khi da thanh toan xong, xem
                        // completeOrder) de khach huy/doi phuong thuc thi khong mat gio.
                        pendingStatus.setValue("Đang chờ thanh toán. Sau khi thanh toán xong, quay lại đây và bấm \"Kiểm tra / thanh toán lại\".");
                        resumePayUrl.setValue(body.getPayUrl());
                        pendingPayUrl.setValue(body.getPayUrl());
                    } else {
                        completeOrder(body, request);
                    }
                } else {
                    if (response.code() >= 400 && response.code() < 500 && response.code() != 408
                            && response.code() != 429) clearPending();
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Đặt hàng thất bại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<OrderDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Chưa xác định được đơn hàng. Bấm kiểm tra / thanh toán lại khi có mạng.");
            }
        });
    }

    // Chi goi khi server THAT SU tra ve mot don: COD, hoac VNPay da thanh toan
    // xong. Luc nay moi xoa cac mon da dat khoi gio.
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
        loading.setValue(false);
        placedOrderId.setValue(orderId);
    }

    private PlaceOrderRequest readPending() {
        String saved = pendingPrefs.getString(pendingKey, null);
        if (saved == null) return null;
        PlaceOrderRequest pending;
        try {
            pending = gson.fromJson(saved, PlaceOrderRequest.class);
        } catch (JsonSyntaxException exception) {
            pending = null;
        }
        if (pending != null && pending.getClientRequestId() != null
                && pending.getItems() != null && !pending.getItems().isEmpty()) {
            return pending;
        }
        clearPending();
        return null;
    }

    private void clearPending() {
        pendingPrefs.edit().remove(pendingKey).apply();
        hasPendingOrder.setValue(false);
        pendingStatus.setValue(null);
        resumePayUrl.setValue(null);
    }

    // Goi khi xoa tai khoan: bo yeu cau dat hang dang cho cua tai khoan nay
    public static void clearPendingFor(Context context) {
        context.getSharedPreferences("delivery_app_checkout", Context.MODE_PRIVATE)
                .edit().remove(pendingKeyFor(context)).apply();
    }
}
