package com.foodgo_app.ui.admin;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.Voucher;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.model.response.VoucherListResponse;
import com.foodgo_app.repository.VoucherRepository;
import com.foodgo_app.util.ApiErrorUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AdminVoucherViewModel extends AndroidViewModel {

    private final VoucherRepository voucherRepository;

    private final MutableLiveData<List<Voucher>> vouchers = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<String> actionSuccess = new MutableLiveData<>();

    public AdminVoucherViewModel(@NonNull Application application) {
        super(application);
        voucherRepository = new VoucherRepository(application);
    }

    public LiveData<List<Voucher>> getVouchers() { return vouchers; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }
    public LiveData<String> getActionSuccess() { return actionSuccess; }

    public void clearError() { error.setValue(null); }
    public void clearActionSuccess() { actionSuccess.setValue(null); }

    public void refresh() {
        loading.setValue(true);
        voucherRepository.getVoucherList().enqueue(new Callback<VoucherListResponse>() {
            @Override
            public void onResponse(@NonNull Call<VoucherListResponse> call, @NonNull Response<VoucherListResponse> response) {
                loading.setValue(false);
                VoucherListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    vouchers.setValue(body.getVouchers() != null ? body.getVouchers() : new ArrayList<>());
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể tải danh sách mã giảm giá"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<VoucherListResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void deleteVoucher(String id) {
        loading.setValue(true);
        voucherRepository.deleteVoucher(id).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                loading.setValue(false);
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    actionSuccess.setValue(body.getMessage());
                    refresh();
                } else {
                    error.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể xóa mã giảm giá"));
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
