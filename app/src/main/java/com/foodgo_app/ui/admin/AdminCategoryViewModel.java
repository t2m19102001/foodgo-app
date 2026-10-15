package com.foodgo_app.ui.admin;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.Category;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.repository.CategoryRepository;
import com.foodgo_app.util.ApiErrorUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AdminCategoryViewModel extends AndroidViewModel {

    private final CategoryRepository categoryRepository;

    private final MutableLiveData<List<Category>> categories = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<String> actionSuccess = new MutableLiveData<>();

    public AdminCategoryViewModel(@NonNull Application application) {
        super(application);
        categoryRepository = new CategoryRepository(application);
    }

    public LiveData<List<Category>> getCategories() { return categories; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }
    public LiveData<String> getActionSuccess() { return actionSuccess; }

    public void clearError() { error.setValue(null); }
    public void clearActionSuccess() { actionSuccess.setValue(null); }

    public void refresh() {
        loading.setValue(true);
        categoryRepository.getCategoryList().enqueue(new Callback<CategoryListResponse>() {
            @Override
            public void onResponse(@NonNull Call<CategoryListResponse> call, @NonNull Response<CategoryListResponse> response) {
                loading.setValue(false);
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
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void deleteCategory(String id) {
        loading.setValue(true);
        categoryRepository.deleteCategory(id).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                loading.setValue(false);
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    actionSuccess.setValue(body.getMessage());
                    refresh();
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể xóa danh mục"));
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
