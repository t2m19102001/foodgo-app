package com.foodgo_app.ui.order;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import android.app.Application;

import androidx.arch.core.executor.testing.InstantTaskExecutorRule;

import com.foodgo_app.model.Order;
import com.foodgo_app.model.response.OrderDetailResponse;
import com.foodgo_app.model.response.OrderListResponse;
import com.foodgo_app.repository.OrderRepository;
import com.foodgo_app.testutil.FakeCall;
import com.google.gson.Gson;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.util.List;

import androidx.annotation.Nullable;
import retrofit2.Call;
import retrofit2.Response;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class OrderViewModelTest {

    @Rule
    public InstantTaskExecutorRule instantTaskExecutorRule = new InstantTaskExecutorRule();

    private static final Gson GSON = new Gson();
    private Application application;

    @Before
    public void setUp() {
        application = RuntimeEnvironment.getApplication();
    }

    @Test
    public void cancellingAnOrderSuccessfullyUpdatesTheDetailAndSignalsSuccess() {
        OrderDetailResponse body = GSON.fromJson(
                "{\"success\":true,\"message\":\"Đã hủy đơn hàng\",\"order\":{\"_id\":\"order-1\",\"status\":\"cancelled\"}}",
                OrderDetailResponse.class);
        OrderRepository fake = new OrderRepository(application) {
            @Override
            public Call<OrderDetailResponse> cancelOrder(String id, String reason) {
                return new FakeCall<>(Response.success(body));
            }
        };
        OrderViewModel viewModel = new OrderViewModel(application, fake);

        viewModel.cancelOrder("order-1", "Đổi ý");

        assertEquals(Boolean.TRUE, viewModel.getCancelSuccess().getValue());
        assertEquals("cancelled", viewModel.getOrderDetail().getValue().getStatus());
    }

    @Test
    public void cancellingAnOrderThatIsNotCancellableSurfacesTheServerMessageAndDoesNotSignalSuccess() {
        OrderRepository fake = new OrderRepository(application) {
            @Override
            public Call<OrderDetailResponse> cancelOrder(String id, String reason) {
                okhttp3.ResponseBody errorBody = okhttp3.ResponseBody.create(
                        okhttp3.MediaType.get("application/json"),
                        "{\"success\":false,\"message\":\"Đơn hàng đang giao, không thể hủy\"}");
                return new FakeCall<>(Response.error(400, errorBody));
            }
        };
        OrderViewModel viewModel = new OrderViewModel(application, fake);

        viewModel.cancelOrder("order-1", "Đổi ý");

        assertEquals("Đơn hàng đang giao, không thể hủy", viewModel.getError().getValue());
        assertNull(viewModel.getCancelSuccess().getValue());
    }

    @Test
    public void firstPageSetsHasMoreFromPaginationTotalPages() {
        OrderListResponse body = GSON.fromJson(
                "{\"success\":true,\"orders\":[{\"_id\":\"o1\"},{\"_id\":\"o2\"}],"
                        + "\"pagination\":{\"currentPage\":1,\"totalPages\":3,\"totalOrders\":30}}",
                OrderListResponse.class);
        OrderRepository fake = new OrderRepository(application) {
            @Override
            public Call<OrderListResponse> getMyOrders(int page, int limit, @Nullable String status) {
                return new FakeCall<>(Response.success(body));
            }
        };
        OrderViewModel viewModel = new OrderViewModel(application, fake);

        viewModel.refreshOrders();

        List<Order> orders = viewModel.getOrders().getValue();
        assertEquals(2, orders.size());
        assertTrue("con trang sau (totalPages=3 > currentPage=1)", Boolean.TRUE.equals(viewModel.getHasMore().getValue()));
    }

    @Test
    public void lastPageSetsHasMoreToFalse() {
        // refreshOrders() luon xin trang 1 - de mo phong "da la trang cuoi",
        // tra ve tong chi co 1 trang (totalPages=1): trang dang xin (1) khong
        // con nho hon tong so trang, nen khong con trang sau.
        OrderListResponse body = GSON.fromJson(
                "{\"success\":true,\"orders\":[{\"_id\":\"o1\"}],"
                        + "\"pagination\":{\"currentPage\":1,\"totalPages\":1,\"totalOrders\":1}}",
                OrderListResponse.class);
        OrderRepository fake = new OrderRepository(application) {
            @Override
            public Call<OrderListResponse> getMyOrders(int page, int limit, @Nullable String status) {
                return new FakeCall<>(Response.success(body));
            }
        };
        OrderViewModel viewModel = new OrderViewModel(application, fake);

        viewModel.refreshOrders();

        assertEquals(false, viewModel.getHasMore().getValue());
    }
}
