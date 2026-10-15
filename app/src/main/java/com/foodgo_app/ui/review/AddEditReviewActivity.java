package com.foodgo_app.ui.review;

import android.os.Bundle;
import android.view.View;
import android.widget.RatingBar;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.textfield.TextInputEditText;
import com.foodgo_app.R;

public class AddEditReviewActivity extends AppCompatActivity {

    private ReviewViewModel viewModel;
    private String foodId;

    private RatingBar ratingBar;
    private TextInputEditText editComment;
    private android.widget.TextView textError;
    private android.widget.ProgressBar progressBar;
    private MaterialButton btnSubmit;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_edit_review);

        foodId = getIntent().getStringExtra("foodId");
        if (foodId == null || foodId.isEmpty()) {
            Toast.makeText(this, "Thiếu thông tin món ăn", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        ratingBar = findViewById(R.id.rating_bar);
        editComment = findViewById(R.id.edit_comment);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnSubmit = findViewById(R.id.btn_submit);

        // Mo tu man chi tiet don hang thi hien thi ten mon dang danh gia
        android.widget.TextView textFoodName = findViewById(R.id.text_food_name);
        String foodName = getIntent().getStringExtra("foodName");
        if (foodName != null && !foodName.trim().isEmpty()) {
            textFoodName.setText(foodName);
            textFoodName.setVisibility(View.VISIBLE);
        }

        viewModel = new ViewModelProvider(this).get(ReviewViewModel.class);

        btnSubmit.setOnClickListener(v -> {
            int rating = (int) ratingBar.getRating();
            String comment = editComment.getText() != null ? editComment.getText().toString() : "";
            viewModel.addReview(foodId, rating, comment);
        });

        observeViewModel();
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
                Toast.makeText(this, "Đánh giá thành công", Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }
}
