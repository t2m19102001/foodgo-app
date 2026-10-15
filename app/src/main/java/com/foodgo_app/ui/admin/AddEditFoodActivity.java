package com.foodgo_app.ui.admin;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.ArrayAdapter;
import android.widget.AutoCompleteTextView;
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
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.textfield.TextInputEditText;
import com.foodgo_app.R;
import com.foodgo_app.model.Category;
import com.foodgo_app.model.Food;
import com.foodgo_app.util.ImageUrlHelper;

import java.util.ArrayList;
import java.util.List;

public class AddEditFoodActivity extends AppCompatActivity {

    private AddEditFoodViewModel viewModel;
    private String foodId;
    private boolean editMode;
    private Uri selectedImageUri;

    private ShapeableImageView imagePreview;
    private TextInputEditText editName;
    private TextInputEditText editDescription;
    private TextInputEditText editPrice;
    private AutoCompleteTextView editCategory;
    private View layoutAvailable;
    private MaterialSwitch switchAvailable;
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
        setContentView(R.layout.activity_add_edit_food);

        foodId = getIntent().getStringExtra("foodId");
        editMode = foodId != null && !foodId.isEmpty();

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setTitle(editMode ? "Sửa món ăn" : "Thêm món ăn");

        imagePreview = findViewById(R.id.image_preview);
        imagePreview.setImageResource(R.drawable.placeholder_food);
        findViewById(R.id.btn_pick_image).setOnClickListener(v ->
                pickImage.launch(new PickVisualMediaRequest.Builder()
                        .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                        .build()));

        editName = findViewById(R.id.edit_name);
        editDescription = findViewById(R.id.edit_description);
        editPrice = findViewById(R.id.edit_price);
        editCategory = findViewById(R.id.edit_category);
        layoutAvailable = findViewById(R.id.layout_available);
        switchAvailable = findViewById(R.id.switch_available);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnSubmit = findViewById(R.id.btn_submit);

        layoutAvailable.setVisibility(editMode ? View.VISIBLE : View.GONE);

        viewModel = new ViewModelProvider(this).get(AddEditFoodViewModel.class);

        btnSubmit.setOnClickListener(v -> submit());

        observeViewModel();
        viewModel.loadCategories();
        if (editMode) {
            viewModel.loadFood(foodId);
        }
    }

    private void submit() {
        String name = textOf(editName);
        String description = textOf(editDescription);
        String priceText = textOf(editPrice);
        String category = textOf(editCategory);

        if (name.isEmpty() || category.isEmpty()) {
            showError("Vui lòng điền tên món ăn và chọn danh mục");
            return;
        }
        double price;
        try {
            price = Double.parseDouble(priceText);
            if (price < 0) throw new NumberFormatException();
        } catch (NumberFormatException e) {
            showError("Giá món ăn không hợp lệ");
            return;
        }

        if (editMode) {
            viewModel.update(foodId, name, description, String.valueOf(price), category,
                    switchAvailable.isChecked(), selectedImageUri);
        } else {
            viewModel.create(name, description, String.valueOf(price), category, selectedImageUri);
        }
    }

    private String textOf(TextView view) {
        return view.getText() != null ? view.getText().toString().trim() : "";
    }

    private void showError(String message) {
        textError.setText(message);
        textError.setVisibility(View.VISIBLE);
    }

    private void bindFood(Food food) {
        if (food == null) return;
        editName.setText(food.getName());
        editDescription.setText(food.getDescription());
        editPrice.setText(String.valueOf((long) food.getPrice()));
        editCategory.setText(food.getCategory(), false);
        switchAvailable.setChecked(food.isAvailable());
        Glide.with(this)
                .load(ImageUrlHelper.getImageUrl(food.getImage()))
                .placeholder(R.drawable.placeholder_food)
                .error(R.drawable.placeholder_food)
                .centerCrop()
                .into(imagePreview);
    }

    private void bindCategories(List<Category> categories) {
        List<String> names = new ArrayList<>();
        for (Category category : categories) {
            if (category.getName() != null) names.add(category.getName());
        }
        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_list_item_1, names);
        editCategory.setAdapter(adapter);
        editCategory.setOnClickListener(v -> editCategory.showDropDown());
    }

    private void observeViewModel() {
        viewModel.getCategories().observe(this, this::bindCategories);
        viewModel.getFood().observe(this, this::bindFood);

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
                Toast.makeText(this, editMode ? "Cập nhật món ăn thành công" : "Thêm món ăn thành công",
                        Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }
}
