package com.foodgo_app.ui.home;

import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.textfield.TextInputEditText;
import com.foodgo_app.R;
import com.foodgo_app.adapter.CategoryAdapter;
import com.foodgo_app.adapter.FoodAdapter;
import com.foodgo_app.model.Category;
import com.foodgo_app.repository.CartRepository;
import com.foodgo_app.ui.home.FoodDetailActivity;
import com.foodgo_app.ui.main.MainActivity;
import com.foodgo_app.util.SessionManager;

import java.util.List;

public class HomeFragment extends Fragment {

    private HomeViewModel viewModel;
    private CartRepository cartRepository;
    private FoodAdapter foodAdapter;
    private CategoryAdapter categoryAdapter;
    private String selectedCategory = null;

    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView textEmpty;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                              @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_home, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        viewModel = new ViewModelProvider(this).get(HomeViewModel.class);
        cartRepository = new CartRepository(requireContext());

        RecyclerView recyclerFood = view.findViewById(R.id.recycler_food);
        RecyclerView recyclerCategory = view.findViewById(R.id.recycler_category);
        TextInputEditText editSearch = view.findViewById(R.id.edit_search);
        swipeRefresh = view.findViewById(R.id.swipe_refresh);
        swipeRefresh.setColorSchemeResources(R.color.colorPrimary);

        String userName = new SessionManager(requireContext()).getUserName();
        TextView textGreeting = view.findViewById(R.id.text_greeting);
        if (userName != null && !userName.isEmpty()) {
            textGreeting.setText("Xin chào, " + userName + "!");
        }
        progressBar = view.findViewById(R.id.progress_bar);
        textEmpty = view.findViewById(R.id.text_empty);

        foodAdapter = new FoodAdapter(
                food -> {
                    Intent intent = new Intent(getActivity(), FoodDetailActivity.class);
                    intent.putExtra("foodId", food.getId());
                    startActivity(intent);
                },
                food -> {
                    cartRepository.addToCart(food);
                    Toast.makeText(getContext(), "Đã thêm " + food.getName() + " vào giỏ hàng",
                            Toast.LENGTH_SHORT).show();
                    if (getActivity() instanceof MainActivity) {
                        ((MainActivity) getActivity()).updateCartBadge();
                    }
                }
        );
        recyclerFood.setLayoutManager(new GridLayoutManager(getContext(), 2));
        recyclerFood.setAdapter(foodAdapter);

        categoryAdapter = new CategoryAdapter(category -> {
            if (category.getName() != null && category.getName().equals(selectedCategory)) {
                selectedCategory = null;
            } else {
                selectedCategory = category.getName();
            }
            categoryAdapter.setSelected(selectedCategory);
            viewModel.filterByCategory(selectedCategory);
        });
        recyclerCategory.setLayoutManager(new LinearLayoutManager(getContext(), LinearLayoutManager.HORIZONTAL, false));
        recyclerCategory.setAdapter(categoryAdapter);

        editSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                viewModel.search(s.toString());
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        swipeRefresh.setOnRefreshListener(() -> {
            viewModel.loadFoods();
            viewModel.loadCategories();
        });

        observeViewModel();
    }

    private void observeViewModel() {
        viewModel.getFoodList().observe(getViewLifecycleOwner(), foods -> {
            foodAdapter.setFoods(foods);
            textEmpty.setVisibility(foods == null || foods.isEmpty() ? View.VISIBLE : View.GONE);
        });

        viewModel.getCategoryList().observe(getViewLifecycleOwner(), categories -> {
            categoryAdapter.setCategories(categories);
        });

        viewModel.getLoading().observe(getViewLifecycleOwner(), isLoading -> {
            if (Boolean.TRUE.equals(isLoading)) {
                if (!swipeRefresh.isRefreshing()) {
                    progressBar.setVisibility(View.VISIBLE);
                }
            } else {
                progressBar.setVisibility(View.GONE);
                swipeRefresh.setRefreshing(false);
            }
        });

        viewModel.getError().observe(getViewLifecycleOwner(), message -> {
            if (message != null && !message.isEmpty() && getContext() != null) {
                Toast.makeText(getContext(), message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });
    }
}
