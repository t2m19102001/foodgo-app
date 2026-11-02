package com.foodgo_app.ui.profile;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;

import com.foodgo_app.R;
import com.foodgo_app.ui.auth.LoginActivity;
import com.foodgo_app.util.Constants;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.google.android.material.textfield.TextInputEditText;

// Xoa tai khoan ngay trong app: yeu cau bat buoc cua Google Play / App Store voi
// app cho phep tao tai khoan. Server an danh hoa du lieu (xem DELETE /api/auth/account).
public class DeleteAccountActivity extends AppCompatActivity {

    private ProfileViewModel viewModel;
    private TextInputEditText editPassword;
    private TextView textError;
    private ProgressBar progressBar;
    private MaterialButton btnDelete;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delete_account);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        editPassword = findViewById(R.id.edit_password);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnDelete = findViewById(R.id.btn_delete_account);

        findViewById(R.id.text_privacy_link).setOnClickListener(v ->
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(Constants.PRIVACY_POLICY_URL))));

        viewModel = new ViewModelProvider(this).get(ProfileViewModel.class);

        btnDelete.setOnClickListener(v -> {
            String password = editPassword.getText() != null ? editPassword.getText().toString() : "";
            if (password.isEmpty()) {
                showError("Vui lòng nhập mật khẩu để xác nhận");
                return;
            }
            new MaterialAlertDialogBuilder(this)
                    .setTitle("Xóa tài khoản?")
                    .setMessage("Tài khoản và dữ liệu cá nhân sẽ bị xóa vĩnh viễn. Bạn chắc chắn chứ?")
                    .setNegativeButton("Không", null)
                    .setPositiveButton("Xóa vĩnh viễn", (dialog, which) -> viewModel.deleteAccount(password))
                    .show();
        });

        observeViewModel();
    }

    private void showError(String message) {
        textError.setText(message);
        textError.setVisibility(View.VISIBLE);
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            boolean loading = Boolean.TRUE.equals(isLoading);
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
            btnDelete.setEnabled(!loading);
        });

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                showError(message);
                viewModel.clearError();
            }
        });

        viewModel.getDeleteAccountSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, "Tài khoản của bạn đã được xóa", Toast.LENGTH_LONG).show();
                Intent intent = new Intent(this, LoginActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            }
        });
    }
}
