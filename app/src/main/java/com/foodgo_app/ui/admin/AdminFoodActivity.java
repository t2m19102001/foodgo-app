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
import com.google.android.material.chip.Chip;
import com.google.android.material.chip.ChipGroup;
import com.foodgo_app.R;
import com.foodgo_app.adapter.AdminFoodAdapter;
import com.foodgo_app.model.Category;
import com.foodgo_app.model.Food;
import com.foodgo_app.util.SessionManager;

import java.util.HashMap;
import java.util.Map;

public class AdminFoodActivity extends AppCompatActivity {

    private AdminFoodViewModel viewModel;
    private AdminFoodAdapter adapter;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView textEmpty;
    private ChipGroup chipGroupCategory;

    // Anh xa id chip dong (sinh tu danh muc API) sang ten danh muc; chip "Tat ca" ung voi null
    private final Map<Integer, String> chipCategory = new HashMap<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin_food);

        if (!new SessionManager(this).isAdmin()) {
            Toast.makeText(this, "Bạn không có quyền truy cập", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_add) {
                startActivity(new Intent(this, AddEditFoodActivity.class));
                return true;
            }
            return false;
        });

        swipeRefresh = findViewById(R.id.swipe_refresh);
        swipeRefresh.setColorSchemeResources(R.color.colorPrimary);
        progressBar = findViewById(R.id.progress_bar);
        textEmpty = findViewById(R.id.text_empty);
        chipGroupCategory = findViewById(R.id.chip_group_category);
        RecyclerView recyclerFoods = findViewById(R.id.recycler_foods);

        viewModel = new ViewModelProvider(this).get(AdminFoodViewModel.class);

        adapter = new AdminFoodAdapter(new AdminFoodAdapter.OnFoodActionListener() {
            @Override
            public void onToggleAvailability(Food food) {
                viewModel.toggleAvailability(food);
            }

            @Override
            public void onEdit(Food food) {
                Intent intent = new Intent(AdminFoodActivity.this, AddEditFoodActivity.class);
                intent.putExtra("foodId", food.getId());
                startActivity(intent);
            }

            @Override
            public void onDelete(Food food) {
                confirmDelete(food);
            }
        });

        recyclerFoods.setLayoutManager(new LinearLayoutManager(this));
        recyclerFoods.setAdapter(adapter);

        chipGroupCategory.setOnCheckedStateChangeListener((group, checkedIds) -> {
            int checkedId = checkedIds.isEmpty() ? R.id.chip_all : checkedIds.get(0);
            viewModel.setCategoryFilter(chipCategory.get(checkedId));
        });

        swipeRefresh.setOnRefreshListener(() -> viewModel.refresh());

        observeViewModel();
        viewModel.refresh();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (viewModel != null) {
            viewModel.refresh();
        }
    }

    private void confirmDelete(Food food) {
        new AlertDialog.Builder(this)
                .setTitle("Xóa món ăn")
                .setMessage("Xóa \"" + food.getName() + "\"? Hành động không thể hoàn tác.")
                .setPositiveButton("Xóa", (dialog, which) -> viewModel.deleteFood(food.getId()))
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void rebuildCategoryChips(java.util.List<Category> categories) {
        // Giu lai id chip dang chon de khong nhay ve "Tat ca" khi refresh danh sach
        Integer previouslyChecked = chipGroupCategory.getCheckedChipId();
        chipGroupCategory.removeAllViews();
        chipCategory.clear();

        Chip chipAll = (Chip) getLayoutInflater().inflate(R.layout.item_filter_chip, chipGroupCategory, false);
        chipAll.setId(R.id.chip_all);
        chipAll.setText("Tất cả");
        chipGroupCategory.addView(chipAll);
        chipCategory.put(R.id.chip_all, null);

        for (Category category : categories) {
            if (category.getName() == null) continue;
            Chip chip = (Chip) getLayoutInflater().inflate(R.layout.item_filter_chip, chipGroupCategory, false);
            chip.setId(View.generateViewId());
            chip.setText(category.getName());
            chipGroupCategory.addView(chip);
            chipCategory.put(chip.getId(), category.getName());
        }

        boolean stillExists = chipCategory.containsKey(previouslyChecked);
        chipGroupCategory.check(stillExists ? previouslyChecked : R.id.chip_all);
    }

    private void observeViewModel() {
        viewModel.getCategories().observe(this, this::rebuildCategoryChips);

        viewModel.getFoods().observe(this, foods -> {
            adapter.setFoods(foods);
            textEmpty.setVisibility(foods == null || foods.isEmpty() ? View.VISIBLE : View.GONE);
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
