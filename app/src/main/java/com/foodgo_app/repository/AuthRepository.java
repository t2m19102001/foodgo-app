package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.AuthResponse;
import com.foodgo_app.model.response.ChangePasswordRequest;
import com.foodgo_app.model.response.LoginRequest;
import com.foodgo_app.model.response.ProfileResponse;
import com.foodgo_app.model.response.RegisterRequest;
import com.foodgo_app.model.response.SimpleResponse;

import okhttp3.MultipartBody;
import okhttp3.RequestBody;
import retrofit2.Call;

public class AuthRepository {

    private final ApiService apiService;

    public AuthRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<AuthResponse> register(String name, String email, String password, String phone) {
        return apiService.register(new RegisterRequest(name, email, password, phone));
    }

    public Call<AuthResponse> login(String email, String password) {
        return apiService.login(new LoginRequest(email, password));
    }

    public Call<ProfileResponse> getProfile() {
        return apiService.getProfile();
    }

    public Call<ProfileResponse> updateProfile(RequestBody name, RequestBody phone,
                                                RequestBody address, MultipartBody.Part image) {
        return apiService.updateProfile(name, phone, address, image);
    }

    public Call<SimpleResponse> changePassword(String oldPassword, String newPassword) {
        return apiService.changePassword(new ChangePasswordRequest(oldPassword, newPassword));
    }
}
