package com.foodgo_app.api;

import androidx.annotation.Nullable;

import com.foodgo_app.model.response.AddReviewRequest;
import com.foodgo_app.model.response.AddressListResponse;
import com.foodgo_app.model.response.AddressResponse;
import com.foodgo_app.model.response.AuthResponse;
import com.foodgo_app.model.response.CancelOrderRequest;
import com.foodgo_app.model.response.CategoryDetailResponse;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.ChangePasswordRequest;
import com.foodgo_app.model.response.EditReviewRequest;
import com.foodgo_app.model.response.FoodDetailResponse;
import com.foodgo_app.model.response.FoodListResponse;
import com.foodgo_app.model.response.LoginRequest;
import com.foodgo_app.model.response.NotificationListResponse;
import com.foodgo_app.model.response.OrderDetailResponse;
import com.foodgo_app.model.response.OrderListResponse;
import com.foodgo_app.model.response.OrderStatsResponse;
import com.foodgo_app.model.response.PlaceOrderRequest;
import com.foodgo_app.model.response.ProfileResponse;
import com.foodgo_app.model.response.RegisterRequest;
import com.foodgo_app.model.response.SaveAddressRequest;
import com.foodgo_app.model.response.ReviewListResponse;
import com.foodgo_app.model.response.ReviewResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.model.response.UpdateStatusRequest;
import com.foodgo_app.model.response.VnpayCreateResponse;

import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.http.Body;
import retrofit2.http.DELETE;
import retrofit2.http.GET;
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

    // ===== Food =====
    @GET("api/food")
    Call<FoodListResponse> getFoodList();

    @GET("api/food/{id}")
    Call<FoodDetailResponse> getFoodById(@Path("id") String id);

    @GET("api/food/category/{category}")
    Call<FoodListResponse> getFoodByCategory(@Path("category") String category);

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

    // status = null thi Retrofit tu bo query param nay (lay tat ca trang thai)
    @GET("api/order/my")
    Call<OrderListResponse> getMyOrders(
            @Query("page") int page,
            @Query("limit") int limit,
            @Query("status") @Nullable String status
    );

    @GET("api/order/{id}")
    Call<OrderDetailResponse> getOrderById(@Path("id") String id);

    @POST("api/order/{id}/vnpay/create-payment")
    Call<VnpayCreateResponse> createVnpayPayment(@Path("id") String id);

    @PUT("api/order/{id}/cancel")
    Call<OrderDetailResponse> cancelOrder(@Path("id") String id, @Body CancelOrderRequest body);

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
}
