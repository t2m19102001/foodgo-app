package com.foodgo_app.ui.auth;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.foodgo_app.R;
import com.foodgo_app.ui.main.MainActivity;

public class LoginActivity extends AppCompatActivity {

    private AuthViewModel viewModel;
    private TextInputEditText editEmail;
    private TextInputEditText editPassword;
    private TextView textError;
    private ProgressBar progressBar;
    private MaterialButton btnLogin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_login);

        viewModel = new ViewModelProvider(this).get(AuthViewModel.class);

        editEmail = findViewById(R.id.edit_email);
        editPassword = findViewById(R.id.edit_password);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnLogin = findViewById(R.id.btn_login);
        TextView textGoRegister = findViewById(R.id.text_go_register);

        btnLogin.setOnClickListener(v -> viewModel.login(
                editEmail.getText() != null ? editEmail.getText().toString() : "",
                editPassword.getText() != null ? editPassword.getText().toString() : ""
        ));

        textGoRegister.setOnClickListener(v ->
                startActivity(new Intent(this, RegisterActivity.class)));

        observeViewModel();
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            progressBar.setVisibility(isLoading ? View.VISIBLE : View.GONE);
            btnLogin.setEnabled(!isLoading);
        });

        viewModel.getErrorMessage().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
            }
        });

        viewModel.getAuthSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                startActivity(new Intent(this, MainActivity.class));
                finish();
            }
        });
    }
}
