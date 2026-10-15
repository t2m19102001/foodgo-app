package com.foodgo_app.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.NonNull;

import androidx.appcompat.app.AppCompatActivity;

import com.foodgo_app.R;
import com.foodgo_app.model.response.ProfileResponse;
import com.foodgo_app.repository.AuthRepository;
import com.foodgo_app.ui.main.MainActivity;
import com.foodgo_app.util.SessionManager;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class SplashActivity extends AppCompatActivity {

    private SessionManager sessionManager;
    private ProgressBar progressBar;
    private TextView textError;
    private Button btnRetry;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_splash);

        sessionManager = new SessionManager(this);
        progressBar = findViewById(R.id.progress_bar);
        textError = findViewById(R.id.text_error);
        btnRetry = findViewById(R.id.btn_retry);
        btnRetry.setOnClickListener(v -> checkSession());
        checkSession();
    }

    private void checkSession() {
        if (!sessionManager.isLoggedIn()) {
            open(LoginActivity.class);
            return;
        }
        progressBar.setVisibility(View.VISIBLE);
        textError.setVisibility(View.GONE);
        btnRetry.setVisibility(View.GONE);
        new AuthRepository(this).getProfile().enqueue(new Callback<ProfileResponse>() {
            @Override
            public void onResponse(@NonNull Call<ProfileResponse> call, @NonNull Response<ProfileResponse> response) {
                if (isFinishing() || isDestroyed()) return;
                if (response.isSuccessful() && response.body() != null && response.body().isSuccess()) {
                    open(MainActivity.class);
                } else if (response.code() == 401 || response.code() == 403) {
                    sessionManager.clearSession();
                    open(LoginActivity.class);
                } else {
                    showError();
                }
            }

            @Override
            public void onFailure(@NonNull Call<ProfileResponse> call, @NonNull Throwable t) {
                if (!isFinishing() && !isDestroyed()) showError();
            }
        });
    }

    private void showError() {
        progressBar.setVisibility(View.GONE);
        textError.setText("Không thể kiểm tra phiên đăng nhập. Vui lòng kết nối mạng rồi thử lại.");
        textError.setVisibility(View.VISIBLE);
        btnRetry.setVisibility(View.VISIBLE);
    }

    private void open(Class<?> activityClass) {
        startActivity(new Intent(this, activityClass));
        finish();
    }
}
