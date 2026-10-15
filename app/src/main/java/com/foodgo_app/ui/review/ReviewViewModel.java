package com.foodgo_app.ui.review;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.response.ReviewResponse;
import com.foodgo_app.repository.ReviewRepository;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ReviewViewModel extends AndroidViewModel {

    private final ReviewRepository reviewRepository;

    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> submitSuccess = new MutableLiveData<>();

    public ReviewViewModel(@NonNull Application application) {
        super(application);
        reviewRepository = new ReviewRepository(application);
    }

    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }
    public LiveData<Boolean> getSubmitSuccess() { return submitSuccess; }

    public void addReview(String foodId, int rating, String comment) {
        if (foodId == null || foodId.isEmpty()) {
            error.setValue("Thiếu thông tin món ăn");
            return;
        }
        if (rating <= 0) {
            error.setValue("Vui lòng chọn số sao đánh giá");
            return;
        }
        if (comment == null || comment.trim().isEmpty()) {
            error.setValue("Vui lòng nhập nhận xét");
            return;
        }

        loading.setValue(true);
        reviewRepository.addReview(foodId, rating, comment.trim()).enqueue(new Callback<ReviewResponse>() {
            @Override
            public void onResponse(@NonNull Call<ReviewResponse> call, @NonNull Response<ReviewResponse> response) {
                loading.setValue(false);
                ReviewResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    submitSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể gửi đánh giá"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ReviewResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }
}
