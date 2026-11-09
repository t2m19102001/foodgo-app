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

public class ForgotPasswordActivity extends AppCompatActivity {

    private AuthViewModel viewModel;
    private TextInputEditText editEmail;
    private TextView textError;
    private ProgressBar progressBar;
    private MaterialButton btnSendCode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_forgot_password);

        viewModel = new ViewModelProvider(this).get(AuthViewModel.class);

        editEmail = findViewById(R.id.edit_email);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnSendCode = findViewById(R.id.btn_send_code);

        btnSendCode.setOnClickListener(v -> viewModel.requestPasswordReset(
                editEmail.getText() != null ? editEmail.getText().toString() : ""));

        observeViewModel();
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            progressBar.setVisibility(isLoading ? View.VISIBLE : View.GONE);
            btnSendCode.setEnabled(!isLoading);
        });

        viewModel.getErrorMessage().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
            }
        });

        viewModel.getResetCodeSent().observe(this, sent -> {
            if (Boolean.TRUE.equals(sent)) {
                String email = editEmail.getText() != null ? editEmail.getText().toString().trim() : "";
                Toast.makeText(this, "Đã gửi mã xác nhận, vui lòng kiểm tra email", Toast.LENGTH_LONG).show();
                Intent intent = new Intent(this, ResetPasswordActivity.class);
                intent.putExtra(ResetPasswordActivity.EXTRA_EMAIL, email);
                startActivity(intent);
                finish();
            }
        });
    }
}
