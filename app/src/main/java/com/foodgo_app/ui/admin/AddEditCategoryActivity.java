package com.foodgo_app.ui.admin;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;

import com.bumptech.glide.Glide;
import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.imageview.ShapeableImageView;
import com.google.android.material.textfield.TextInputEditText;
import com.foodgo_app.R;
import com.foodgo_app.util.ImageUrlHelper;

public class AddEditCategoryActivity extends AppCompatActivity {

    private AddEditCategoryViewModel viewModel;
    private String categoryId;
    private boolean editMode;
    private Uri selectedImageUri;

    private ShapeableImageView imagePreview;
    private TextInputEditText editName;
    private TextView textError;
    private ProgressBar progressBar;
    private MaterialButton btnSubmit;

    private final ActivityResultLauncher<PickVisualMediaRequest> pickImage =
            registerForActivityResult(new ActivityResultContracts.PickVisualMedia(), uri -> {
                if (uri != null) {
                    selectedImageUri = uri;
                    Glide.with(this).load(uri).centerCrop().into(imagePreview);
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_edit_category);

        categoryId = getIntent().getStringExtra("categoryId");
        editMode = categoryId != null && !categoryId.isEmpty();

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setTitle(editMode ? "Sửa danh mục" : "Thêm danh mục");

        imagePreview = findViewById(R.id.image_preview);
        imagePreview.setImageResource(R.drawable.placeholder_food);
        findViewById(R.id.btn_pick_image).setOnClickListener(v ->
                pickImage.launch(new PickVisualMediaRequest.Builder()
                        .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                        .build()));

        editName = findViewById(R.id.edit_name);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnSubmit = findViewById(R.id.btn_submit);

        if (editMode) {
            editName.setText(getIntent().getStringExtra("categoryName"));
            Glide.with(this)
                    .load(ImageUrlHelper.getImageUrl(getIntent().getStringExtra("categoryImage")))
                    .placeholder(R.drawable.placeholder_food)
                    .error(R.drawable.placeholder_food)
                    .centerCrop()
                    .into(imagePreview);
        }

        viewModel = new ViewModelProvider(this).get(AddEditCategoryViewModel.class);

        btnSubmit.setOnClickListener(v -> submit());

        observeViewModel();
    }

    private void submit() {
        String name = editName.getText() != null ? editName.getText().toString().trim() : "";
        if (name.isEmpty()) {
            showError("Vui lòng điền tên danh mục");
            return;
        }
        if (editMode) {
            viewModel.update(categoryId, name, selectedImageUri);
        } else {
            viewModel.create(name, selectedImageUri);
        }
    }

    private void showError(String message) {
        textError.setText(message);
        textError.setVisibility(View.VISIBLE);
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            boolean loading = Boolean.TRUE.equals(isLoading);
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
            btnSubmit.setEnabled(!loading);
        });

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                showError(message);
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getSubmitSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, editMode ? "Cập nhật danh mục thành công" : "Thêm danh mục thành công",
                        Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }
}
