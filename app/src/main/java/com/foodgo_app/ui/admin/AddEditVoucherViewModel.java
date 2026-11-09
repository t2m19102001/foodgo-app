package com.foodgo_app.ui.admin;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.response.SaveVoucherRequest;
import com.foodgo_app.model.response.VoucherDetailResponse;
import com.foodgo_app.repository.VoucherRepository;
import com.foodgo_app.util.ApiErrorUtils;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AddEditVoucherViewModel extends AndroidViewModel {

    private final VoucherRepository voucherRepository;

    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> submitSuccess = new MutableLiveData<>(false);

    public AddEditVoucherViewModel(@NonNull Application application) {
        super(application);
        voucherRepository = new VoucherRepository(application);
    }

    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }
    public LiveData<Boolean> getSubmitSuccess() { return submitSuccess; }

    public void clearError() { error.setValue(null); }

    public void create(SaveVoucherRequest body) {
        loading.setValue(true);
        voucherRepository.createVoucher(body).enqueue(submitCallback());
    }

    public void update(String id, SaveVoucherRequest body) {
        loading.setValue(true);
        voucherRepository.updateVoucher(id, body).enqueue(submitCallback());
    }

    private Callback<VoucherDetailResponse> submitCallback() {
        return new Callback<VoucherDetailResponse>() {
            @Override
            public void onResponse(@NonNull Call<VoucherDetailResponse> call, @NonNull Response<VoucherDetailResponse> response) {
                loading.setValue(false);
                VoucherDetailResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    submitSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể lưu mã giảm giá"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<VoucherDetailResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        };
    }
}
