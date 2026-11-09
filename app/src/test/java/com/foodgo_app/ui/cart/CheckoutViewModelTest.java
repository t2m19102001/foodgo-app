package com.foodgo_app.ui.cart;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.junit.Assert.fail;

import android.app.Application;
import android.content.Context;
import android.content.SharedPreferences;

import androidx.arch.core.executor.testing.InstantTaskExecutorRule;

import com.foodgo_app.model.Food;
import com.foodgo_app.model.response.AddressListResponse;
import com.foodgo_app.model.response.OrderDetailResponse;
import com.foodgo_app.model.response.PlaceOrderRequest;
import com.foodgo_app.repository.AddressRepository;
import com.foodgo_app.repository.CartRepository;
import com.foodgo_app.repository.OrderRepository;
import com.foodgo_app.testutil.FakeCall;
import com.foodgo_app.util.SessionManager;
import com.google.gson.Gson;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import retrofit2.Call;
import retrofit2.Response;

// Luong rui ro nhat cua app: dat hang + thanh toan treo. Khoa muon giu lai
// qua test: (1) khong goi API khi chua du dieu kien, (2) don COD xoa gio
// ngay, (3) don VNPay dang CHO thanh toan KHONG xoa gio va khong "hoan tat"
// cho toi khi thanh toan xong, (4) dat hang lan 2 khi dang co pending phai
// KIEM TRA lai don cu thay vi tao don moi.
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class CheckoutViewModelTest {

    @Rule
    public InstantTaskExecutorRule instantTaskExecutorRule = new InstantTaskExecutorRule();

    private static final Gson GSON = new Gson();
    private Application application;
    private CartRepository cartRepository;

    private static Food food(String id, String name, double price) {
        return GSON.fromJson(
                String.format("{\"_id\":\"%s\",\"name\":\"%s\",\"price\":%s}", id, name, price),
                Food.class);
    }

    @Before
    public void setUp() {
        application = RuntimeEnvironment.getApplication();
        new SessionManager(application).saveSession("tok", "user1", "Nguyen Van A", false, false);
        cartRepository = new CartRepository(application);
    }

    private AddressRepository addressRepositoryWithDefault() {
        AddressListResponse body = GSON.fromJson(
                "{\"success\":true,\"addresses\":[{\"_id\":\"addr1\",\"fullName\":\"A\",\"phone\":\"0900000000\","
                        + "\"address\":\"1 Le Loi\",\"isDefault\":true}]}",
                AddressListResponse.class);
        return new AddressRepository(application) {
            @Override
            public Call<AddressListResponse> getMyAddresses() {
                return new FakeCall<>(Response.success(body));
            }
        };
    }

    private AddressRepository addressRepositoryWithNoAddress() {
        AddressListResponse body = GSON.fromJson("{\"success\":true,\"addresses\":[]}", AddressListResponse.class);
        return new AddressRepository(application) {
            @Override
            public Call<AddressListResponse> getMyAddresses() {
                return new FakeCall<>(Response.success(body));
            }
        };
    }

    private SharedPreferences pendingPrefs() {
        return application.getSharedPreferences("delivery_app_checkout", Context.MODE_PRIVATE);
    }

    @Test
    public void placingAnEmptyCartNeverCallsTheServer() {
        OrderRepository refusing = new OrderRepository(application) {
            @Override
            public Call<OrderDetailResponse> placeOrder(PlaceOrderRequest request) {
                fail("khong duoc goi placeOrder khi gio hang rong");
                return null;
            }
        };
        CheckoutViewModel viewModel = new CheckoutViewModel(
                application, cartRepository, refusing, addressRepositoryWithDefault());

        viewModel.placeOrder("cod");

        assertEquals("Giỏ hàng trống", viewModel.getError().getValue());
    }

    @Test
    public void placingAnOrderWithoutASelectedAddressNeverCallsTheServer() {
        cartRepository.addToCart(food("f1", "Phở bò", 50000));
        OrderRepository refusing = new OrderRepository(application) {
            @Override
            public Call<OrderDetailResponse> placeOrder(PlaceOrderRequest request) {
                fail("khong duoc goi placeOrder khi chua co dia chi giao hang");
                return null;
            }
        };
        CheckoutViewModel viewModel = new CheckoutViewModel(
                application, cartRepository, refusing, addressRepositoryWithNoAddress());

        viewModel.placeOrder("cod");

        assertEquals("Vui lòng chọn hoặc thêm địa chỉ giao hàng", viewModel.getError().getValue());
    }

    @Test
    public void codOrderClearsTheCartAndSetsThePlacedOrderIdImmediately() {
        cartRepository.addToCart(food("f1", "Phở bò", 50000));
        OrderDetailResponse body = GSON.fromJson(
                "{\"success\":true,\"message\":\"Đặt hàng thành công\",\"orderId\":\"order-cod-1\"}",
                OrderDetailResponse.class);
        OrderRepository fake = new OrderRepository(application) {
            @Override
            public Call<OrderDetailResponse> placeOrder(PlaceOrderRequest request) {
                return new FakeCall<>(Response.success(body));
            }
        };
        CheckoutViewModel viewModel = new CheckoutViewModel(
                application, cartRepository, fake, addressRepositoryWithDefault());

        viewModel.placeOrder("cod");

        assertEquals("order-cod-1", viewModel.getPlacedOrderId().getValue());
        assertTrue("gio hang phai duoc xoa sau khi don COD thanh cong", cartRepository.getCartItems().isEmpty());
        assertFalse("khong con yeu cau dang cho sau khi don da hoan tat",
                Boolean.TRUE.equals(viewModel.getHasPendingOrder().getValue()));
    }

    @Test
    public void vnpayOrderKeepsTheCartUntilPaymentActuallySucceeds() {
        cartRepository.addToCart(food("f1", "Phở bò", 50000));
        OrderDetailResponse body = GSON.fromJson(
                "{\"success\":true,\"message\":\"Đang chờ thanh toán\","
                        + "\"payUrl\":\"https://sandbox.vnpayment.vn/pay?x=1\"}",
                OrderDetailResponse.class);
        OrderRepository fake = new OrderRepository(application) {
            @Override
            public Call<OrderDetailResponse> placeOrder(PlaceOrderRequest request) {
                return new FakeCall<>(Response.success(body));
            }
        };
        CheckoutViewModel viewModel = new CheckoutViewModel(
                application, cartRepository, fake, addressRepositoryWithDefault());

        viewModel.placeOrder("vnpay");

        assertNull("don VNPay chua thanh toan khong co orderId", viewModel.getPlacedOrderId().getValue());
        assertEquals("https://sandbox.vnpayment.vn/pay?x=1", viewModel.getPendingPayUrl().getValue());
        assertFalse("gio hang phai GIU NGUYEN cho toi khi thanh toan xong",
                cartRepository.getCartItems().isEmpty());
        assertTrue("phai luu lai yeu cau dang cho tren may", pendingPrefs().contains("pending_user1"));
    }

    @Test
    public void placingAnOrderWhilePendingPaymentExistsChecksStatusInsteadOfCreatingANewOne() {
        cartRepository.addToCart(food("f1", "Phở bò", 50000));
        OrderDetailResponse pendingBody = GSON.fromJson(
                "{\"success\":true,\"message\":\"Đang chờ thanh toán\","
                        + "\"payUrl\":\"https://sandbox.vnpayment.vn/pay?x=1\"}",
                OrderDetailResponse.class);
        int[] placeOrderCalls = {0};
        int[] checkStatusCalls = {0};
        OrderRepository fake = new OrderRepository(application) {
            @Override
            public Call<OrderDetailResponse> placeOrder(PlaceOrderRequest request) {
                placeOrderCalls[0]++;
                return new FakeCall<>(Response.success(pendingBody));
            }

            @Override
            public Call<OrderDetailResponse> getOrderByRequestId(String clientRequestId) {
                checkStatusCalls[0]++;
                OrderDetailResponse stillPending = GSON.fromJson(
                        "{\"success\":true,\"paymentPending\":true,\"paymentStatus\":\"unpaid\","
                                + "\"message\":\"Đang chờ thanh toán\"}",
                        OrderDetailResponse.class);
                return new FakeCall<>(Response.success(stillPending));
            }
        };
        CheckoutViewModel viewModel = new CheckoutViewModel(
                application, cartRepository, fake, addressRepositoryWithDefault());

        viewModel.placeOrder("vnpay");
        assertEquals(1, placeOrderCalls[0]);

        // Bam "dat hang" lan nua trong luc dang co pending: phai kiem tra lai
        // don cu, KHONG tao don moi (tranh tao hai don cho cung mot gio hang)
        viewModel.placeOrder("vnpay");
        assertEquals(1, placeOrderCalls[0]);
        assertEquals(1, checkStatusCalls[0]);
    }
}
