package com.foodgo_app.api;

import androidx.annotation.Nullable;

import com.foodgo_app.model.response.AddReviewRequest;
import com.foodgo_app.model.response.AddressListResponse;
import com.foodgo_app.model.response.AddressResponse;
import com.foodgo_app.model.response.AiSearchRequest;
import com.foodgo_app.model.response.AiSearchResponse;
import com.foodgo_app.model.response.AssignDriverRequest;
import com.foodgo_app.model.response.AuthResponse;
import com.foodgo_app.model.response.CancelOrderRequest;
import com.foodgo_app.model.response.CategoryDetailResponse;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.ChangePasswordRequest;
import com.foodgo_app.model.response.ChatHistoryResponse;
import com.foodgo_app.model.response.ChatMessageRequest;
import com.foodgo_app.model.response.ChatSendResponse;
import com.foodgo_app.model.response.DeleteAccountRequest;
import com.foodgo_app.model.response.DriverListResponse;
import com.foodgo_app.model.response.EditReviewRequest;
import com.foodgo_app.model.response.FoodDetailResponse;
import com.foodgo_app.model.response.FoodListResponse;
import com.foodgo_app.model.response.ForgotPasswordRequest;
import com.foodgo_app.model.response.HomeRecommendationsResponse;
import com.foodgo_app.model.response.LoginRequest;
import com.foodgo_app.model.response.RestaurantLocationResponse;
import com.foodgo_app.model.response.NotificationListResponse;
import com.foodgo_app.model.response.OrderDetailResponse;
import com.foodgo_app.model.response.OrderListResponse;
import com.foodgo_app.model.response.OrderStatsResponse;
import com.foodgo_app.model.response.PlaceOrderRequest;
import com.foodgo_app.model.response.ProfileResponse;
import com.foodgo_app.model.response.RegisterRequest;
import com.foodgo_app.model.response.ResetPasswordRequest;
import com.foodgo_app.model.response.SaveAddressRequest;
import com.foodgo_app.model.response.ReviewListResponse;
import com.foodgo_app.model.response.ReviewResponse;
import com.foodgo_app.model.response.SetDriverFlagRequest;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.model.response.UpdateDriverLocationRequest;
import com.foodgo_app.model.response.UpdateStatusRequest;
import com.foodgo_app.model.response.ValidateVoucherRequest;
import com.foodgo_app.model.response.ValidateVoucherResponse;
import com.foodgo_app.model.response.SaveVoucherRequest;
import com.foodgo_app.model.response.VoucherDetailResponse;
import com.foodgo_app.model.response.VoucherListResponse;

import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
import retrofit2.http.HTTP;
import retrofit2.http.Multipart;
import retrofit2.http.PUT;
import retrofit2.http.POST;
import retrofit2.http.Part;
import retrofit2.http.Path;
import retrofit2.http.Query;

public interface ApiService {

    // ===== Auth =====
    @POST("api/auth/register")
    Call<AuthResponse> register(@Body RegisterRequest body);

    @POST("api/auth/login")
    Call<AuthResponse> login(@Body LoginRequest body);

    @GET("api/auth/profile")
    Call<ProfileResponse> getProfile();

    @Multipart
    @PUT("api/auth/profile")
    Call<ProfileResponse> updateProfile(
            @Part("name") RequestBody name,
            @Part("phone") RequestBody phone,
            @Part("address") RequestBody address,
            @Part MultipartBody.Part image
    );

    @PUT("api/auth/change-password")
    Call<SimpleResponse> changePassword(@Body ChangePasswordRequest body);

    @POST("api/auth/forgot-password")
    Call<SimpleResponse> forgotPassword(@Body ForgotPasswordRequest body);

    @POST("api/auth/reset-password")
    Call<SimpleResponse> resetPassword(@Body ResetPasswordRequest body);

    // DELETE co body (mat khau xac nhan) - @DELETE cua Retrofit khong cho gui body
    @HTTP(method = "DELETE", path = "api/auth/account", hasBody = true)
    Call<SimpleResponse> deleteAccount(@Body DeleteAccountRequest body);

    // ===== Food =====
    @GET("api/food")
    Call<FoodListResponse> getFoodList();

    @GET("api/food/{id}")
    Call<FoodDetailResponse> getFoodById(@Path("id") String id);

    @GET("api/food/category/{category}")
    Call<FoodListResponse> getFoodByCategory(@Path("category") String category);

    // AI Search - rule-based truoc, Gemini la fallback phia server
    @POST("api/food/ai-search")
    Call<AiSearchResponse> aiSearchFood(@Body AiSearchRequest body);

    // ===== Food (admin) =====
    @Multipart
    @POST("api/food")
    Call<FoodDetailResponse> createFood(
            @Part("name") RequestBody name,
            @Part("description") RequestBody description,
            @Part("price") RequestBody price,
            @Part("category") RequestBody category,
            @Part MultipartBody.Part image
    );

    @Multipart
    @PUT("api/food/{id}")
    Call<FoodDetailResponse> updateFood(
            @Path("id") String id,
            @Part("name") RequestBody name,
            @Part("description") RequestBody description,
            @Part("price") RequestBody price,
            @Part("category") RequestBody category,
            @Part("isAvailable") RequestBody isAvailable,
            @Part @Nullable MultipartBody.Part image
    );

    @DELETE("api/food/{id}")
    Call<SimpleResponse> deleteFood(@Path("id") String id);

    // ===== Category =====
    @GET("api/category")
    Call<CategoryListResponse> getCategoryList();

    // ===== Category (admin) =====
    @Multipart
    @POST("api/category")
    Call<CategoryDetailResponse> createCategory(
            @Part("name") RequestBody name,
            @Part @Nullable MultipartBody.Part image
    );

    @Multipart
    @PUT("api/category/{id}")
    Call<CategoryDetailResponse> updateCategory(
            @Path("id") String id,
            @Part("name") RequestBody name,
            @Part @Nullable MultipartBody.Part image
    );

    @DELETE("api/category/{id}")
    Call<SimpleResponse> deleteCategory(@Path("id") String id);

    // ===== Order =====
    @POST("api/order")
    Call<OrderDetailResponse> placeOrder(@Body PlaceOrderRequest body);

    @GET("api/order/request/{clientRequestId}")
    Call<OrderDetailResponse> getOrderByRequestId(@Path("clientRequestId") String clientRequestId);

    // Bo thanh toan VNPay dang cho de doi phuong thuc / doi gio hang
    @POST("api/order/request/{clientRequestId}/abandon")
    Call<OrderDetailResponse> abandonPendingPayment(@Path("clientRequestId") String clientRequestId);

    // status = null thi Retrofit tu bo query param nay (lay tat ca trang thai)
    @GET("api/order/my")
    Call<OrderListResponse> getMyOrders(
            @Query("page") int page,
            @Query("limit") int limit,
            @Query("status") @Nullable String status
    );

    @GET("api/order/{id}")
    Call<OrderDetailResponse> getOrderById(@Path("id") String id);

    @PUT("api/order/{id}/cancel")
    Call<OrderDetailResponse> cancelOrder(@Path("id") String id, @Body CancelOrderRequest body);

    @PUT("api/order/{id}/assign-driver")
    Call<OrderDetailResponse> assignDriver(@Path("id") String id, @Body AssignDriverRequest body);

    // ===== Order (admin) =====
    @GET("api/order/list")
    Call<OrderListResponse> getAllOrders(
            @Query("page") int page,
            @Query("limit") int limit,
            @Query("status") @Nullable String status
    );

    @PUT("api/order/{id}/status")
    Call<OrderDetailResponse> updateOrderStatus(@Path("id") String id, @Body UpdateStatusRequest body);

    @GET("api/order/stats")
    Call<OrderStatsResponse> getOrderStats();

    // ===== Address =====
    @GET("api/address")
    Call<AddressListResponse> getMyAddresses();

    @POST("api/address")
    Call<AddressResponse> addAddress(@Body SaveAddressRequest body);

    @PUT("api/address/{id}")
    Call<AddressResponse> updateAddress(@Path("id") String id, @Body SaveAddressRequest body);

    @PUT("api/address/{id}/default")
    Call<AddressResponse> setDefaultAddress(@Path("id") String id);

    @DELETE("api/address/{id}")
    Call<SimpleResponse> deleteAddress(@Path("id") String id);

    // ===== Review =====
    @GET("api/review/food/{foodId}")
    Call<ReviewListResponse> getFoodReviews(@Path("foodId") String foodId);

    @POST("api/review")
    Call<ReviewResponse> addReview(@Body AddReviewRequest body);

    @PUT("api/review/{id}")
    Call<ReviewResponse> editReview(@Path("id") String id, @Body EditReviewRequest body);

    @DELETE("api/review/{id}")
    Call<SimpleResponse> deleteReview(@Path("id") String id);

    // ===== Notification =====
    @GET("api/notification")
    Call<NotificationListResponse> getNotifications();

    @PUT("api/notification/{id}/read")
    Call<SimpleResponse> markNotificationRead(@Path("id") String id);

    @PUT("api/notification/read-all")
    Call<SimpleResponse> markAllNotificationsRead();

    // ===== AI Chatbot =====
    @POST("api/chat/message")
    Call<ChatSendResponse> sendChatMessage(@Body ChatMessageRequest body);

    @GET("api/chat/history")
    Call<ChatHistoryResponse> getChatHistory();

    // ===== AI Recommendation =====
    @GET("api/recommendations/home")
    Call<HomeRecommendationsResponse> getHomeRecommendations();

    // ===== Maps =====
    @GET("api/restaurant/location")
    Call<RestaurantLocationResponse> getRestaurantLocation();

    // ===== Driver (self) =====
    @GET("api/driver/orders")
    Call<OrderListResponse> getMyDeliveries();

    @PUT("api/driver/location")
    Call<SimpleResponse> updateMyDriverLocation(@Body UpdateDriverLocationRequest body);

    // ===== Driver (admin) =====
    @GET("api/auth/drivers")
    Call<DriverListResponse> getDrivers();

    @PUT("api/auth/users/{id}/driver")
    Call<SimpleResponse> setDriverFlag(@Path("id") String id, @Body SetDriverFlagRequest body);

    // ===== Voucher =====
    @POST("api/voucher/validate")
    Call<ValidateVoucherResponse> validateVoucher(@Body ValidateVoucherRequest body);

    // ===== Voucher (admin) =====
    @GET("api/voucher")
    Call<VoucherListResponse> getVoucherList();

    @POST("api/voucher")
    Call<VoucherDetailResponse> createVoucher(@Body SaveVoucherRequest body);

    @PUT("api/voucher/{id}")
    Call<VoucherDetailResponse> updateVoucher(@Path("id") String id, @Body SaveVoucherRequest body);

    @DELETE("api/voucher/{id}")
    Call<SimpleResponse> deleteVoucher(@Path("id") String id);
}
