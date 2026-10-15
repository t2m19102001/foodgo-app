package com.foodgo_app.ui.admin;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.Category;
import com.foodgo_app.model.Food;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.FoodDetailResponse;
import com.foodgo_app.model.response.FoodListResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.repository.CategoryRepository;
import com.foodgo_app.repository.FoodRepository;
import com.foodgo_app.util.ApiErrorUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AdminFoodViewModel extends AndroidViewModel {

    private final FoodRepository foodRepository;
    private final CategoryRepository categoryRepository;

    private final MutableLiveData<List<Food>> foods = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<List<Category>> categories = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<String> actionSuccess = new MutableLiveData<>();

    private List<Food> allFoods = new ArrayList<>();
    private String categoryFilter = null;

    public AdminFoodViewModel(@NonNull Application application) {
        super(application);
        foodRepository = new FoodRepository(application);
        categoryRepository = new CategoryRepository(application);
    }

    public LiveData<List<Food>> getFoods() { return foods; }
    public LiveData<List<Category>> getCategories() { return categories; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }
    public LiveData<String> getActionSuccess() { return actionSuccess; }

    public void clearError() { error.setValue(null); }
    public void clearActionSuccess() { actionSuccess.setValue(null); }

    public void setCategoryFilter(@Nullable String category) {
        categoryFilter = category;
        applyFilter();
    }

    public void refresh() {
        loadFoods();
        loadCategories();
    }

    private void loadFoods() {
        loading.setValue(true);
        foodRepository.getFoodList().enqueue(new Callback<FoodListResponse>() {
            @Override
            public void onResponse(@NonNull Call<FoodListResponse> call, @NonNull Response<FoodListResponse> response) {
                loading.setValue(false);
                FoodListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    allFoods = body.getFoods() != null ? body.getFoods() : new ArrayList<>();
                    applyFilter();
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể tải danh sách món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<FoodListResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    private void loadCategories() {
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

    private void applyFilter() {
        if (categoryFilter == null || categoryFilter.isEmpty()) {
            foods.setValue(new ArrayList<>(allFoods));
            return;
        }
        List<Food> result = new ArrayList<>();
        for (Food food : allFoods) {
            if (categoryFilter.equalsIgnoreCase(food.getCategory())) {
                result.add(food);
            }
        }
        foods.setValue(result);
    }

    // Bat/tat het hang: giu nguyen cac field khac, khong gui lai anh
    public void toggleAvailability(Food food) {
        loading.setValue(true);
        foodRepository.updateFood(
                food.getId(), food.getName(), food.getDescription(),
                String.valueOf(food.getPrice()), food.getCategory(), !food.isAvailable(), null
        ).enqueue(new Callback<FoodDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<FoodDetailResponse> call, @NonNull Response<FoodDetailResponse> response) {
                loading.setValue(false);
                FoodDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    loadFoods();
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể cập nhật món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<FoodDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void deleteFood(String id) {
        loading.setValue(true);
        foodRepository.deleteFood(id).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                loading.setValue(false);
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    actionSuccess.setValue(body.getMessage());
                    loadFoods();
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể xóa món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<SimpleResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }
}
