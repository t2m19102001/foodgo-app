package com.foodgo_app.ui.admin;

import android.app.Application;
import android.net.Uri;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.response.CategoryDetailResponse;
import com.foodgo_app.repository.CategoryRepository;
import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.util.MultipartUtils;

import okhttp3.MultipartBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AddEditCategoryViewModel extends AndroidViewModel {

    private final CategoryRepository categoryRepository;

    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> submitSuccess = new MutableLiveData<>(false);

    public AddEditCategoryViewModel(@NonNull Application application) {
        super(application);
        categoryRepository = new CategoryRepository(application);
    }

    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }
    public LiveData<Boolean> getSubmitSuccess() { return submitSuccess; }

    public void clearError() { error.setValue(null); }

    public void create(String name, @Nullable Uri imageUri) {
        MultipartBody.Part image = buildImagePart(imageUri);
        if (image == null && imageUri != null) return; // loi doc anh da bao qua error LiveData
        loading.setValue(true);
        categoryRepository.createCategory(name, image).enqueue(submitCallback());
    }

    public void update(String id, String name, @Nullable Uri imageUri) {
        MultipartBody.Part image = buildImagePart(imageUri);
        if (image == null && imageUri != null) return;
        loading.setValue(true);
        categoryRepository.updateCategory(id, name, image).enqueue(submitCallback());
    }

    @Nullable
    private MultipartBody.Part buildImagePart(@Nullable Uri imageUri) {
        if (imageUri == null) return null;
        try {
            return MultipartUtils.imagePart(getApplication(), imageUri);
        } catch (Exception e) {
            error.setValue("Không đọc được ảnh đã chọn");
            return null;
        }
    }

    private Callback<CategoryDetailResponse> submitCallback() {
        return new Callback<CategoryDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<CategoryDetailResponse> call, @NonNull Response<CategoryDetailResponse> response) {
                loading.setValue(false);
                CategoryDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    submitSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể lưu danh mục"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<CategoryDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        };
    }
}
