package com.foodgo_app.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;

import com.foodgo_app.R;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;

public class ResetPasswordActivity extends AppCompatActivity {

    public static final String EXTRA_EMAIL = "extra_email";

    private AuthViewModel viewModel;
    private String email;
    private TextInputEditText editCode;
    private TextInputEditText editNewPassword;
    private TextView textError;
    private ProgressBar progressBar;
    private MaterialButton btnResetPassword;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_reset_password);

        email = getIntent().getStringExtra(EXTRA_EMAIL);
        viewModel = new ViewModelProvider(this).get(AuthViewModel.class);

        editCode = findViewById(R.id.edit_code);
        editNewPassword = findViewById(R.id.edit_new_password);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnResetPassword = findViewById(R.id.btn_reset_password);

        btnResetPassword.setOnClickListener(v -> viewModel.resetPassword(
                email,
                editCode.getText() != null ? editCode.getText().toString() : "",
                editNewPassword.getText() != null ? editNewPassword.getText().toString() : ""));

        observeViewModel();
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            progressBar.setVisibility(isLoading ? View.VISIBLE : View.GONE);
            btnResetPassword.setEnabled(!isLoading);
        });

        viewModel.getErrorMessage().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
            }
        });

        viewModel.getResetPasswordSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, "Đặt lại mật khẩu thành công, vui lòng đăng nhập lại", Toast.LENGTH_LONG).show();
                startActivity(new Intent(this, LoginActivity.class)
                        .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK));
                finish();
            }
        });
    }
}
