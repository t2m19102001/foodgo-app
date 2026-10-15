package com.foodgo_app.ui.profile;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.foodgo_app.R;
import com.foodgo_app.model.User;

import okhttp3.MediaType;
import okhttp3.RequestBody;

public class EditProfileActivity extends AppCompatActivity {

    private ProfileViewModel viewModel;

    private TextInputEditText editName;
    private TextInputEditText editPhone;
    private TextInputEditText editAddress;
    private TextView textError;
    private android.widget.ProgressBar progressBar;
    private MaterialButton btnSave;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_profile);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        editName = findViewById(R.id.edit_name);
        editPhone = findViewById(R.id.edit_phone);
        editAddress = findViewById(R.id.edit_address);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnSave = findViewById(R.id.btn_save);

        viewModel = new ViewModelProvider(this).get(ProfileViewModel.class);

        btnSave.setOnClickListener(v -> {
            String name = textOf(editName);
            String phone = textOf(editPhone);
            String address = textOf(editAddress);
            if (name.isEmpty()) {
                textError.setText("Vui lòng nhập họ tên");
                textError.setVisibility(View.VISIBLE);
                return;
            }
            RequestBody nameBody = RequestBody.create(MediaType.parse("text/plain"), name);
            RequestBody phoneBody = RequestBody.create(MediaType.parse("text/plain"), phone);
            RequestBody addressBody = RequestBody.create(MediaType.parse("text/plain"), address);
            viewModel.updateProfile(nameBody, phoneBody, addressBody, null);
        });

        observeViewModel();
        viewModel.loadProfile();
    }

    private String textOf(TextInputEditText editText) {
        return editText.getText() != null ? editText.getText().toString().trim() : "";
    }

    private void observeViewModel() {
        viewModel.getUser().observe(this, this::bindUser);

        viewModel.getLoading().observe(this, isLoading -> {
            boolean loading = Boolean.TRUE.equals(isLoading);
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
            btnSave.setEnabled(!loading);
        });

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getUpdateSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, "Cập nhật hồ sơ thành công", Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }

    private void bindUser(User user) {
        if (user == null) {
            return;
        }
        if (editName.getText() == null || editName.getText().toString().isEmpty()) {
            editName.setText(user.getName());
        }
        if (editPhone.getText() == null || editPhone.getText().toString().isEmpty()) {
            editPhone.setText(user.getPhone());
        }
        if (editAddress.getText() == null || editAddress.getText().toString().isEmpty()) {
            editAddress.setText(user.getAddress());
        }
    }
}
