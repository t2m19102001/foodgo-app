package com.foodgo_app.ui.admin;

import android.app.Application;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.Category;
import com.foodgo_app.model.Food;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.FoodDetailResponse;
import com.foodgo_app.repository.CategoryRepository;
import com.foodgo_app.repository.FoodRepository;
import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.util.MultipartUtils;

import java.util.ArrayList;
import java.util.List;

import okhttp3.MultipartBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AddEditFoodViewModel extends AndroidViewModel {

    private final FoodRepository foodRepository;
    private final CategoryRepository categoryRepository;

    private final MutableLiveData<List<Category>> categories = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<Food> food = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> submitSuccess = new MutableLiveData<>(false);

    public AddEditFoodViewModel(@NonNull Application application) {
        super(application);
        foodRepository = new FoodRepository(application);
        categoryRepository = new CategoryRepository(application);
    }

    public LiveData<List<Category>> getCategories() { return categories; }
    public LiveData<Food> getFood() { return food; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }
    public LiveData<Boolean> getSubmitSuccess() { return submitSuccess; }

    public void clearError() { error.setValue(null); }

    public void loadCategories() {
        categoryRepository.getCategoryList().enqueue(new Callback<CategoryListResponse>() {
            @Override
            public void onResponse(@NonNull Call<CategoryListResponse> call, @NonNull Response<CategoryListResponse> response) {
                CategoryListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    categories.setValue(body.getCategories() != null ? body.getCategories() : new ArrayList<>());
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể tải danh mục"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<CategoryListResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void loadFood(String id) {
        loading.setValue(true);
        foodRepository.getFoodById(id).enqueue(new Callback<FoodDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<FoodDetailResponse> call, @NonNull Response<FoodDetailResponse> response) {
                loading.setValue(false);
                FoodDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    food.setValue(body.getFood());
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể tải thông tin món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<FoodDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void create(String name, String description, String price, String category, @Nullable Uri imageUri) {
        MultipartBody.Part image;
        try {
            if (imageUri == null) {
                error.setValue("Vui lòng chọn ảnh món ăn");
                return;
            }
            image = MultipartUtils.imagePart(getApplication(), imageUri);
        } catch (Exception e) {
            error.setValue("Không đọc được ảnh đã chọn");
            return;
        }
        loading.setValue(true);
        foodRepository.createFood(name, description, price, category, image).enqueue(submitCallback());
    }

    public void update(String id, String name, String description, String price, String category,
                        boolean isAvailable, @Nullable Uri imageUri) {
        MultipartBody.Part image = null;
        if (imageUri != null) {
            try {
                image = MultipartUtils.imagePart(getApplication(), imageUri);
            } catch (Exception e) {
                error.setValue("Không đọc được ảnh đã chọn");
                return;
            }
        }
        loading.setValue(true);
        foodRepository.updateFood(id, name, description, price, category, isAvailable, image)
                .enqueue(submitCallback());
    }

    private Callback<FoodDetailResponse> submitCallback() {
        return new Callback<FoodDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<FoodDetailResponse> call, @NonNull Response<FoodDetailResponse> response) {
                loading.setValue(false);
                FoodDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    submitSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể lưu món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<FoodDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        };
    }
}
