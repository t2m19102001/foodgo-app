package com.foodgo_app.ui.address;

import android.os.Bundle;
import android.view.View;
import android.widget.CheckBox;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.google.gson.Gson;
import com.foodgo_app.R;
import com.foodgo_app.model.SavedAddress;

public class AddEditAddressActivity extends AppCompatActivity {

    private AddressViewModel viewModel;
    private SavedAddress editingAddress;

    private TextInputEditText editFullName;
    private TextInputEditText editPhone;
    private TextInputEditText editAddress;
    private TextInputEditText editNote;
    private CheckBox checkboxDefault;
    private TextView textError;
    private android.widget.ProgressBar progressBar;
    private MaterialButton btnSubmit;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_edit_address);

        String addressJson = getIntent().getStringExtra("addressJson");
        if (addressJson != null) {
            editingAddress = new Gson().fromJson(addressJson, SavedAddress.class);
        }

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setTitle(editingAddress != null ? "Sửa địa chỉ" : "Thêm địa chỉ");

        editFullName = findViewById(R.id.edit_full_name);
        editPhone = findViewById(R.id.edit_phone);
        editAddress = findViewById(R.id.edit_address);
        editNote = findViewById(R.id.edit_note);
        checkboxDefault = findViewById(R.id.checkbox_default);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnSubmit = findViewById(R.id.btn_submit);

        if (editingAddress != null) {
            editFullName.setText(editingAddress.getFullName());
            editPhone.setText(editingAddress.getPhone());
            editAddress.setText(editingAddress.getAddress());
            editNote.setText(editingAddress.getNote());
            // Dat lam mac dinh chi thao tac tu man danh sach, khong sua qua form Edit
            checkboxDefault.setVisibility(View.GONE);
        }

        viewModel = new ViewModelProvider(this).get(AddressViewModel.class);

        btnSubmit.setOnClickListener(v -> {
            String fullName = textOf(editFullName);
            String phone = textOf(editPhone);
            String addressText = textOf(editAddress);
            String note = textOf(editNote);
            if (editingAddress != null) {
                viewModel.updateAddress(editingAddress.getId(), fullName, phone, addressText, note);
            } else {
                viewModel.addAddress(fullName, phone, addressText, note, checkboxDefault.isChecked());
            }
        });

        observeViewModel();
    }

    private String textOf(TextInputEditText editText) {
        return editText.getText() != null ? editText.getText().toString() : "";
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            boolean loading = Boolean.TRUE.equals(isLoading);
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
            btnSubmit.setEnabled(!loading);
        });

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getSubmitSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, "Đã lưu địa chỉ", Toast.LENGTH_SHORT).show();
                setResult(RESULT_OK);
                finish();
            }
        });
    }
}
