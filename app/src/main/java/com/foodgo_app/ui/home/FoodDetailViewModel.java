package com.foodgo_app.ui.home;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.Food;
import com.foodgo_app.model.Review;
import com.foodgo_app.model.response.FoodDetailResponse;
import com.foodgo_app.model.response.ReviewListResponse;
import com.foodgo_app.repository.CartRepository;
import com.foodgo_app.repository.FoodRepository;
import com.foodgo_app.repository.ReviewRepository;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class FoodDetailViewModel extends AndroidViewModel {

    private final FoodRepository foodRepository;
    private final ReviewRepository reviewRepository;
    private final CartRepository cartRepository;

    private final MutableLiveData<Food> food = new MutableLiveData<>();
    private final MutableLiveData<List<Review>> reviews = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<String> addedToCartMessage = new MutableLiveData<>();

    public FoodDetailViewModel(@NonNull Application application) {
        super(application);
        foodRepository = new FoodRepository(application);
        reviewRepository = new ReviewRepository(application);
        cartRepository = new CartRepository(application);
    }

    public LiveData<Food> getFood() { return food; }
    public LiveData<List<Review>> getReviews() { return reviews; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }
    public LiveData<String> getAddedToCartMessage() { return addedToCartMessage; }

    public void loadFood(String foodId) {
        loading.setValue(true);
        foodRepository.getFoodById(foodId).enqueue(new Callback<FoodDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<FoodDetailResponse> call, @NonNull Response<FoodDetailResponse> response) {
                loading.setValue(false);
                FoodDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    food.setValue(body.getFood());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải thông tin món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<FoodDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void loadReviews(String foodId) {
        reviewRepository.getFoodReviews(foodId).enqueue(new Callback<ReviewListResponse>() {
            @Override
            public void onResponse(@NonNull Call<ReviewListResponse> call, @NonNull Response<ReviewListResponse> response) {
                ReviewListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    reviews.setValue(body.getReviews() != null ? body.getReviews() : new ArrayList<>());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải đánh giá"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ReviewListResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void addToCart() {
        Food current = food.getValue();
        if (current == null) {
            return;
        }
        cartRepository.addToCart(current);
        addedToCartMessage.setValue("Đã thêm vào giỏ hàng");
    }
}
