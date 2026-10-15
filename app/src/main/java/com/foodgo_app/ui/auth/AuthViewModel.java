package com.foodgo_app.ui.auth;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.response.AuthResponse;
import com.foodgo_app.repository.AuthRepository;
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

    public AuthViewModel(@NonNull Application application) {
        super(application);
        authRepository = new AuthRepository(application);
        sessionManager = new SessionManager(application);
    }

    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getErrorMessage() { return errorMessage; }
    public LiveData<Boolean> getAuthSuccess() { return authSuccess; }

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

    private void handleAuthResponse(Response<AuthResponse> response) {
        AuthResponse body = response.body();
        if (response.isSuccessful() && body != null && body.isSuccess()) {
            sessionManager.saveSession(body.getToken(), body.getUserId(), body.getName(), body.isAdmin());
            authSuccess.setValue(true);
        } else {
            String message = body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Đã có lỗi xảy ra");
            errorMessage.setValue(message);
        }
    }
}
