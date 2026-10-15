package com.foodgo_app.ui.address;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.SavedAddress;
import com.foodgo_app.model.response.AddressListResponse;
import com.foodgo_app.model.response.AddressResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.repository.AddressRepository;
import com.foodgo_app.util.ApiErrorUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AddressViewModel extends AndroidViewModel {

    private final AddressRepository addressRepository;

    private final MutableLiveData<List<SavedAddress>> addresses = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> submitSuccess = new MutableLiveData<>();

    public AddressViewModel(@NonNull Application application) {
        super(application);
        addressRepository = new AddressRepository(application);
    }

    public LiveData<List<SavedAddress>> getAddresses() { return addresses; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }
    public LiveData<Boolean> getSubmitSuccess() { return submitSuccess; }

    private boolean validateFields(String fullName, String phone, String addressText) {
        if (fullName == null || fullName.trim().isEmpty()
                || phone == null || phone.trim().isEmpty()
                || addressText == null || addressText.trim().isEmpty()) {
            error.setValue("Vui lòng nhập đầy đủ thông tin địa chỉ");
            return false;
        }
        return true;
    }

    public void addAddress(String fullName, String phone, String addressText, String note, boolean isDefault) {
        if (!validateFields(fullName, phone, addressText)) return;
        loading.setValue(true);
        addressRepository.addAddress(fullName.trim(), phone.trim(), addressText.trim(), note, isDefault)
                .enqueue(new Callback<AddressResponse>() {
                    @Override
                    public void onResponse(@NonNull Call<AddressResponse> call, @NonNull Response<AddressResponse> response) {
                        loading.setValue(false);
                        AddressResponse body = response.body();
                        if (response.isSuccessful() && body != null && body.isSuccess()) {
                            submitSuccess.setValue(true);
                        } else {
                            error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể lưu địa chỉ"));
                        }
                    }

                    @Override
                    public void onFailure(@NonNull Call<AddressResponse> call, @NonNull Throwable t) {
                        loading.setValue(false);
                        error.setValue("Không thể kết nối tới server: " + t.getMessage());
                    }
                });
    }

    public void updateAddress(String id, String fullName, String phone, String addressText, String note) {
        if (!validateFields(fullName, phone, addressText)) return;
        loading.setValue(true);
        addressRepository.updateAddress(id, fullName.trim(), phone.trim(), addressText.trim(), note)
                .enqueue(new Callback<AddressResponse>() {
                    @Override
                    public void onResponse(@NonNull Call<AddressResponse> call, @NonNull Response<AddressResponse> response) {
                        loading.setValue(false);
                        AddressResponse body = response.body();
                        if (response.isSuccessful() && body != null && body.isSuccess()) {
                            submitSuccess.setValue(true);
                        } else {
                            error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể cập nhật địa chỉ"));
                        }
                    }

                    @Override
                    public void onFailure(@NonNull Call<AddressResponse> call, @NonNull Throwable t) {
                        loading.setValue(false);
                        error.setValue("Không thể kết nối tới server: " + t.getMessage());
                    }
                });
    }

    public void loadAddresses() {
        loading.setValue(true);
        addressRepository.getMyAddresses().enqueue(new Callback<AddressListResponse>() {
            @Override
            public void onResponse(@NonNull Call<AddressListResponse> call, @NonNull Response<AddressListResponse> response) {
                loading.setValue(false);
                AddressListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    addresses.setValue(body.getAddresses() != null ? body.getAddresses() : new ArrayList<>());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải danh sách địa chỉ"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<AddressListResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void setDefault(String id) {
        addressRepository.setDefaultAddress(id).enqueue(new Callback<AddressResponse>() {
            @Override
            public void onResponse(@NonNull Call<AddressResponse> call, @NonNull Response<AddressResponse> response) {
                AddressResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    loadAddresses();
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể đặt địa chỉ mặc định"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<AddressResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void delete(String id) {
        addressRepository.deleteAddress(id).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    loadAddresses();
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể xóa địa chỉ"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<SimpleResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }
}
