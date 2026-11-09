package com.foodgo_app.ui.auth;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.response.AuthResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.repository.AuthRepository;
import com.foodgo_app.util.CrashReporter;
import com.foodgo_app.util.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class AuthViewModel extends AndroidViewModel {

    private final AuthRepository authRepository;
    private final SessionManager sessionManager;

    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> errorMessage = new MutableLiveData<>();
    private final MutableLiveData<Boolean> authSuccess = new MutableLiveData<>();
    private final MutableLiveData<String> infoMessage = new MutableLiveData<>();
    private final MutableLiveData<Boolean> resetCodeSent = new MutableLiveData<>();
    private final MutableLiveData<Boolean> resetPasswordSuccess = new MutableLiveData<>();

    public AuthViewModel(@NonNull Application application) {
        this(application, new AuthRepository(application));
    }

    // Package-private: dung de inject AuthRepository gia trong unit test
    // (xem app/src/test/java/com/foodgo_app/ui/auth/AuthViewModelTest.java),
    // khong dung o production - ViewModelProvider chi goi constructor 1 tham so.
    AuthViewModel(@NonNull Application application, AuthRepository authRepository) {
        super(application);
        this.authRepository = authRepository;
        this.sessionManager = new SessionManager(application);
    }

    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getErrorMessage() { return errorMessage; }
    public LiveData<Boolean> getAuthSuccess() { return authSuccess; }
    public LiveData<String> getInfoMessage() { return infoMessage; }
    public LiveData<Boolean> getResetCodeSent() { return resetCodeSent; }
    public LiveData<Boolean> getResetPasswordSuccess() { return resetPasswordSuccess; }

    public void login(String email, String password) {
        if (email == null || email.trim().isEmpty() || password == null || password.isEmpty()) {
            errorMessage.setValue("Vui lòng nhập đầy đủ email và mật khẩu");
            return;
        }

        loading.setValue(true);
        authRepository.login(email.trim(), password).enqueue(new Callback<AuthResponse>() {
            @Override
            public void onResponse(@NonNull Call<AuthResponse> call, @NonNull Response<AuthResponse> response) {
                loading.setValue(false);
                handleAuthResponse(response);
            }

            @Override
            public void onFailure(@NonNull Call<AuthResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                errorMessage.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void register(String name, String email, String password, String phone) {
        if (name == null || name.trim().isEmpty() || email == null || email.trim().isEmpty()
                || password == null || password.isEmpty()) {
            errorMessage.setValue("Vui lòng điền đầy đủ thông tin bắt buộc");
            return;
        }

        loading.setValue(true);
        authRepository.register(name.trim(), email.trim(), password, phone)
                .enqueue(new Callback<AuthResponse>() {
                    @Override
                    public void onResponse(@NonNull Call<AuthResponse> call, @NonNull Response<AuthResponse> response) {
                        loading.setValue(false);
                        handleAuthResponse(response);
                    }

                    @Override
                    public void onFailure(@NonNull Call<AuthResponse> call, @NonNull Throwable t) {
                        loading.setValue(false);
                        errorMessage.setValue("Không thể kết nối tới server: " + t.getMessage());
                    }
                });
    }

    public void requestPasswordReset(String email) {
        if (email == null || email.trim().isEmpty()) {
            errorMessage.setValue("Vui lòng nhập email");
            return;
        }

        loading.setValue(true);
        authRepository.forgotPassword(email.trim()).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                loading.setValue(false);
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    infoMessage.setValue(body.getMessage());
                    resetCodeSent.setValue(true);
                } else {
                    errorMessage.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể gửi yêu cầu, vui lòng thử lại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<SimpleResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                errorMessage.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void resetPassword(String email, String code, String newPassword) {
        if (email == null || email.trim().isEmpty()
                || code == null || code.trim().isEmpty()
                || newPassword == null || newPassword.length() < 6) {
            errorMessage.setValue("Vui lòng điền đầy đủ email, mã xác nhận và mật khẩu mới (tối thiểu 6 ký tự)");
            return;
        }

        loading.setValue(true);
        authRepository.resetPassword(email.trim(), code.trim(), newPassword).enqueue(new Callback<SimpleResponse>() {
            @Override
            public void onResponse(@NonNull Call<SimpleResponse> call, @NonNull Response<SimpleResponse> response) {
                loading.setValue(false);
                SimpleResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    resetPasswordSuccess.setValue(true);
                } else {
                    errorMessage.setValue(body != null ? body.getMessage()
                            : ApiErrorUtils.getMessage(response, "Không thể đặt lại mật khẩu, vui lòng thử lại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<SimpleResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                errorMessage.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    private void handleAuthResponse(Response<AuthResponse> response) {
        AuthResponse body = response.body();
        if (response.isSuccessful() && body != null && body.isSuccess()) {
            sessionManager.saveSession(body.getToken(), body.getUserId(), body.getName(), body.isAdmin(), body.isDriver());
            CrashReporter.setUserId(body.getUserId());
            authSuccess.setValue(true);
        } else {
            String message = body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Đã có lỗi xảy ra");
            errorMessage.setValue(message);
        }
    }
}
