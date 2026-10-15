package com.foodgo_app.ui.home;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.google.android.material.button.MaterialButton;
import com.foodgo_app.R;
import com.foodgo_app.adapter.ReviewAdapter;
import com.foodgo_app.model.Food;
import com.foodgo_app.ui.review.AddEditReviewActivity;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.ImageUrlHelper;
import com.foodgo_app.util.SessionManager;

public class FoodDetailActivity extends AppCompatActivity {

    public static final String EXTRA_FOOD_ID = "foodId";

    private FoodDetailViewModel viewModel;
    private ReviewAdapter reviewAdapter;
    private String foodId;

    private ImageView imageFood;
    private TextView textName;
    private TextView textPrice;
    private TextView textDescription;
    private TextView textNoReview;
    private ProgressBar progressBar;
    private MaterialButton btnAddToCart;
    private MaterialButton btnWriteReview;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_food_detail);

        foodId = getIntent().getStringExtra(EXTRA_FOOD_ID);
        if (foodId == null) {
            Toast.makeText(this, "Không tìm thấy món ăn", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        imageFood = findViewById(R.id.image_food);
        textName = findViewById(R.id.text_name);
        textPrice = findViewById(R.id.text_price);
        textDescription = findViewById(R.id.text_description);
        textNoReview = findViewById(R.id.text_no_review);
        progressBar = findViewById(R.id.progress_bar);
        btnAddToCart = findViewById(R.id.btn_add_to_cart);
        btnWriteReview = findViewById(R.id.btn_write_review);
        RecyclerView recyclerReview = findViewById(R.id.recycler_review);

        reviewAdapter = new ReviewAdapter();
        recyclerReview.setLayoutManager(new LinearLayoutManager(this));
        recyclerReview.setAdapter(reviewAdapter);

        viewModel = new ViewModelProvider(this).get(FoodDetailViewModel.class);

        btnAddToCart.setOnClickListener(v -> viewModel.addToCart());

        SessionManager sessionManager = new SessionManager(this);
        if (sessionManager.isLoggedIn()) {
            btnWriteReview.setVisibility(View.VISIBLE);
            btnWriteReview.setOnClickListener(v -> {
                Intent intent = new Intent(this, AddEditReviewActivity.class);
                intent.putExtra("foodId", foodId);
                startActivity(intent);
            });
        } else {
            btnWriteReview.setVisibility(View.GONE);
        }

        observeViewModel();

        viewModel.loadFood(foodId);
        viewModel.loadReviews(foodId);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (foodId != null) {
            viewModel.loadReviews(foodId);
        }
    }

    private void observeViewModel() {
        viewModel.getFood().observe(this, this::bindFood);

        viewModel.getReviews().observe(this, reviews -> {
            reviewAdapter.setReviews(reviews);
            textNoReview.setVisibility(reviews == null || reviews.isEmpty() ? View.VISIBLE : View.GONE);
        });

        viewModel.getLoading().observe(this, isLoading ->
                progressBar.setVisibility(Boolean.TRUE.equals(isLoading) ? View.VISIBLE : View.GONE));

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getAddedToCartMessage().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void bindFood(Food food) {
        if (food == null) {
            return;
        }
        textName.setText(food.getName());
        textPrice.setText(CurrencyUtils.formatVnd(food.getPrice()));
        textDescription.setText(food.getDescription());

        // Mon het hang thi khong cho them vao gio
        boolean available = food.isAvailable();
        btnAddToCart.setEnabled(available);
        btnAddToCart.setText(available ? "Thêm vào giỏ hàng" : "Món tạm hết hàng");
        Glide.with(this)
                .load(ImageUrlHelper.getImageUrl(food.getImage()))
                .placeholder(R.drawable.placeholder_food)
                .error(R.drawable.placeholder_food)
                .centerCrop()
                .into(imageFood);
    }
}
