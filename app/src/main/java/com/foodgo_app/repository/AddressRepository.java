package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.AddressListResponse;
import com.foodgo_app.model.response.AddressResponse;
import com.foodgo_app.model.response.SaveAddressRequest;
import com.foodgo_app.model.response.SimpleResponse;

import retrofit2.Call;

public class AddressRepository {

    private final ApiService apiService;

    public AddressRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<AddressListResponse> getMyAddresses() {
        return apiService.getMyAddresses();
    }

    public Call<AddressResponse> addAddress(String fullName, String phone, String address, String note, boolean isDefault) {
        return apiService.addAddress(new SaveAddressRequest(fullName, phone, address, note, isDefault));
    }

    public Call<AddressResponse> updateAddress(String id, String fullName, String phone, String address, String note) {
        return apiService.updateAddress(id, new SaveAddressRequest(fullName, phone, address, note, false));
    }

    public Call<AddressResponse> setDefaultAddress(String id) {
        return apiService.setDefaultAddress(id);
    }

    public Call<SimpleResponse> deleteAddress(String id) {
        return apiService.deleteAddress(id);
    }
}
