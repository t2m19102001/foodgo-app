package com.foodgo_app.ui.profile;

import android.os.Bundle;
import android.content.Intent;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.foodgo_app.R;
import com.foodgo_app.ui.auth.LoginActivity;

public class ChangePasswordActivity extends AppCompatActivity {

    private ProfileViewModel viewModel;

    private TextInputEditText editOldPassword;
    private TextInputEditText editNewPassword;
    private TextView textError;
    private android.widget.ProgressBar progressBar;
    private MaterialButton btnChangePassword;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_change_password);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        editOldPassword = findViewById(R.id.edit_old_password);
        editNewPassword = findViewById(R.id.edit_new_password);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnChangePassword = findViewById(R.id.btn_change_password);

        viewModel = new ViewModelProvider(this).get(ProfileViewModel.class);

        btnChangePassword.setOnClickListener(v -> viewModel.changePassword(
                textOf(editOldPassword), textOf(editNewPassword)));

        observeViewModel();
    }

    private String textOf(TextInputEditText editText) {
        return editText.getText() != null ? editText.getText().toString() : "";
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            boolean loading = Boolean.TRUE.equals(isLoading);
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
            btnChangePassword.setEnabled(!loading);
        });

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getChangePasswordSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, "Đổi mật khẩu thành công. Vui lòng đăng nhập lại", Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(this, LoginActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            }
        });
    }
}
