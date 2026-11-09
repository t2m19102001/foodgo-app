package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.SaveVoucherRequest;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.model.response.ValidateVoucherRequest;
import com.foodgo_app.model.response.ValidateVoucherResponse;
import com.foodgo_app.model.response.VoucherDetailResponse;
import com.foodgo_app.model.response.VoucherListResponse;

import retrofit2.Call;

public class VoucherRepository {

    private final ApiService apiService;

    public VoucherRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<ValidateVoucherResponse> validateVoucher(String code, double orderAmount) {
        return apiService.validateVoucher(new ValidateVoucherRequest(code, orderAmount));
    }

    // ===== Danh cho admin =====
    public Call<VoucherListResponse> getVoucherList() {
        return apiService.getVoucherList();
    }

    public Call<VoucherDetailResponse> createVoucher(SaveVoucherRequest body) {
        return apiService.createVoucher(body);
    }

    public Call<VoucherDetailResponse> updateVoucher(String id, SaveVoucherRequest body) {
        return apiService.updateVoucher(id, body);
    }

    public Call<SimpleResponse> deleteVoucher(String id) {
        return apiService.deleteVoucher(id);
    }
}
