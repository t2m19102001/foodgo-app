package com.foodgo_app.ui.profile;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.User;
import com.foodgo_app.model.response.ProfileResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.repository.AuthRepository;
import com.foodgo_app.repository.CartRepository;
import com.foodgo_app.ui.cart.CheckoutViewModel;
import com.foodgo_app.util.CrashReporter;
import com.foodgo_app.util.SessionManager;

import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ProfileViewModel extends AndroidViewModel {

    private final AuthRepository authRepository;
    private final SessionManager sessionManager;

    private final MutableLiveData<User> user = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    private final MutableLiveData<Boolean> updateSuccess = new MutableLiveData<>();
    private final MutableLiveData<Boolean> changePasswordSuccess = new MutableLiveData<>();
    private final MutableLiveData<Boolean> deleteAccountSuccess = new MutableLiveData<>();

    public ProfileViewModel(@NonNull Application application) {
        super(application);
        authRepository = new AuthRepository(application);
        sessionManager = new SessionManager(application);
    }

    public LiveData<User> getUser() { return user; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }
    public LiveData<Boolean> getUpdateSuccess() { return updateSuccess; }
    public LiveData<Boolean> getChangePasswordSuccess() { return changePasswordSuccess; }
    public LiveData<Boolean> getDeleteAccountSuccess() { return deleteAccountSuccess; }

    public void loadProfile() {
        loading.setValue(true);
        authRepository.getProfile().enqueue(new Callback<ProfileResponse>() {
            @Override
            public void onResponse(@NonNull Call<ProfileResponse> call, @NonNull Response<ProfileResponse> response) {
                loading.setValue(false);
                ProfileResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    user.setValue(body.getUser());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải thông tin hồ sơ"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ProfileResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void updateProfile(RequestBody name, RequestBody phone, RequestBody address, MultipartBody.Part image) {
        loading.setValue(true);
        authRepository.updateProfile(name, phone, address, image).enqueue(new Callback<ProfileResponse>() {
            @Override
            public void onResponse(@NonNull Call<ProfileResponse> call, @NonNull Response<ProfileResponse> response) {
                loading.setValue(false);
                ProfileResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    user.setValue(body.getUser());
                    updateSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Cập nhật hồ sơ thất bại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ProfileResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void changePassword(String oldPassword, String newPassword) {
        if (oldPassword == null || oldPassword.isEmpty() || newPassword == null || newPassword.isEmpty()) {
            error.setValue("Vui lòng nhập đầy đủ mật khẩu");
            return;
        }
        loading.setValue(true);
        authRepository.changePassword(oldPassword, newPassword).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                loading.setValue(false);
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    sessionManager.clearSession();
                    changePasswordSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Đổi mật khẩu thất bại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<SimpleResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void deleteAccount(String password) {
        if (password == null || password.isEmpty()) {
            error.setValue("Vui lòng nhập mật khẩu để xác nhận");
            return;
        }
        loading.setValue(true);
        authRepository.deleteAccount(password).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                loading.setValue(false);
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    // Xoa moi du lieu cua tai khoan tren may TRUOC khi xoa phien:
                    // khoa gio hang / don cho tinh theo userId cua phien hien tai
                    new CartRepository(getApplication()).clearCart();
                    CheckoutViewModel.clearPendingFor(getApplication());
                    CrashReporter.setUserId(null);
                    sessionManager.clearSession();
                    deleteAccountSuccess.setValue(true);
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Xóa tài khoản thất bại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<SimpleResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server. Vui lòng thử lại khi có mạng.");
            }
        });
    }

    public void logout() {
        CrashReporter.setUserId(null);
        sessionManager.clearSession();
    }
}
