package com.foodgo_app.ui.admin;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.appbar.MaterialToolbar;
import com.foodgo_app.R;
import com.foodgo_app.adapter.AdminCategoryAdapter;
import com.foodgo_app.model.Category;
import com.foodgo_app.util.SessionManager;

public class AdminCategoryActivity extends AppCompatActivity {

    private AdminCategoryViewModel viewModel;
    private AdminCategoryAdapter adapter;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView textEmpty;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin_category);

        if (!new SessionManager(this).isAdmin()) {
            Toast.makeText(this, "Bạn không có quyền truy cập", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_add) {
                startActivity(new Intent(this, AddEditCategoryActivity.class));
                return true;
            }
            return false;
        });

        swipeRefresh = findViewById(R.id.swipe_refresh);
        swipeRefresh.setColorSchemeResources(R.color.colorPrimary);
        progressBar = findViewById(R.id.progress_bar);
        textEmpty = findViewById(R.id.text_empty);
        RecyclerView recyclerCategories = findViewById(R.id.recycler_categories);

        viewModel = new ViewModelProvider(this).get(AdminCategoryViewModel.class);

        adapter = new AdminCategoryAdapter(new AdminCategoryAdapter.OnCategoryActionListener() {
            @Override
            public void onEdit(Category category) {
                Intent intent = new Intent(AdminCategoryActivity.this, AddEditCategoryActivity.class);
                intent.putExtra("categoryId", category.getId());
                intent.putExtra("categoryName", category.getName());
                intent.putExtra("categoryImage", category.getImage());
                startActivity(intent);
            }

            @Override
            public void onDelete(Category category) {
                confirmDelete(category);
            }
        });

        recyclerCategories.setLayoutManager(new LinearLayoutManager(this));
        recyclerCategories.setAdapter(adapter);

        swipeRefresh.setOnRefreshListener(() -> viewModel.refresh());

        observeViewModel();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (viewModel != null) {
            viewModel.refresh();
        }
    }

    private void confirmDelete(Category category) {
        new AlertDialog.Builder(this)
                .setTitle("Xóa danh mục")
                .setMessage("Xóa danh mục \"" + category.getName() + "\"? Không thể xóa nếu còn món ăn thuộc danh mục này.")
                .setPositiveButton("Xóa", (dialog, which) -> viewModel.deleteCategory(category.getId()))
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void observeViewModel() {
        viewModel.getCategories().observe(this, categories -> {
            adapter.setCategories(categories);
            textEmpty.setVisibility(categories == null || categories.isEmpty() ? View.VISIBLE : View.GONE);
        });

        viewModel.getLoading().observe(this, isLoading -> {
            if (Boolean.TRUE.equals(isLoading)) {
                if (!swipeRefresh.isRefreshing()) {
                    progressBar.setVisibility(View.VISIBLE);
                }
            } else {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }
        });

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getActionSuccess().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearActionSuccess();
            }
        });
    }
}
