package com.foodgo_app.ui.home;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.Category;
import com.foodgo_app.model.Food;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.FoodListResponse;
import com.foodgo_app.repository.CategoryRepository;
import com.foodgo_app.repository.FoodRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HomeViewModel extends AndroidViewModel {

    private final FoodRepository foodRepository;
    private final CategoryRepository categoryRepository;

    private final MutableLiveData<List<Food>> foodList = new MutableLiveData<>();
    private final MutableLiveData<List<Category>> categoryList = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();

    private List<Food> allFoods = new ArrayList<>();
    private String currentCategory = null;
    private String currentKeyword = null;

    public HomeViewModel(@NonNull Application application) {
        super(application);
        foodRepository = new FoodRepository(application);
        categoryRepository = new CategoryRepository(application);
        loadFoods();
        loadCategories();
    }

    public LiveData<List<Food>> getFoodList() { return foodList; }
    public LiveData<List<Category>> getCategoryList() { return categoryList; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }

    public void loadFoods() {
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
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải danh sách món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<FoodListResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void loadCategories() {
        categoryRepository.getCategoryList().enqueue(new Callback<CategoryListResponse>() {
            @Override
            public void onResponse(@NonNull Call<CategoryListResponse> call, @NonNull Response<CategoryListResponse> response) {
                CategoryListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    categoryList.setValue(body.getCategories() != null ? body.getCategories() : new ArrayList<>());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải danh mục"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<CategoryListResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void filterByCategory(String category) {
        currentCategory = category;
        applyFilter();
    }

    public void search(String keyword) {
        currentKeyword = keyword;
        applyFilter();
    }

    private void applyFilter() {
        List<Food> result = new ArrayList<>();
        for (Food food : allFoods) {
            boolean matchCategory = currentCategory == null || currentCategory.isEmpty()
                    || currentCategory.equalsIgnoreCase(food.getCategory());
            boolean matchKeyword = currentKeyword == null || currentKeyword.trim().isEmpty()
                    || (food.getName() != null
                        && food.getName().toLowerCase(Locale.getDefault())
                            .contains(currentKeyword.trim().toLowerCase(Locale.getDefault())));
            if (matchCategory && matchKeyword) {
                result.add(food);
            }
        }
        foodList.setValue(result);
    }
}
