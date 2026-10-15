package com.foodgo_app.ui.order;

import android.content.Intent;
import android.os.Bundle;
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
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.chip.ChipGroup;
import com.foodgo_app.R;
import com.foodgo_app.adapter.OrderAdapter;
import com.foodgo_app.util.OrderStatusHelper;

public class OrderHistoryFragment extends Fragment {

    private OrderViewModel viewModel;
    private OrderAdapter adapter;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView textEmpty;
    private boolean hasLoadedOnce = false;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                              @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_order_history, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        viewModel = new ViewModelProvider(this).get(OrderViewModel.class);

        RecyclerView recyclerOrders = view.findViewById(R.id.recycler_orders);
        swipeRefresh = view.findViewById(R.id.swipe_refresh);
        swipeRefresh.setColorSchemeResources(R.color.colorPrimary);
        progressBar = view.findViewById(R.id.progress_bar);
        textEmpty = view.findViewById(R.id.text_empty);
        ChipGroup chipGroupStatus = view.findViewById(R.id.chip_group_status);

        adapter = new OrderAdapter(order -> {
            Intent intent = new Intent(getActivity(), OrderDetailActivity.class);
            intent.putExtra("orderId", order.getId());
            startActivity(intent);
        });

        LinearLayoutManager layoutManager = new LinearLayoutManager(getContext());
        recyclerOrders.setLayoutManager(layoutManager);
        recyclerOrders.setAdapter(adapter);
        recyclerOrders.addOnScrollListener(new RecyclerView.OnScrollListener() {
            @Override
            public void onScrolled(@NonNull RecyclerView recyclerView, int dx, int dy) {
                super.onScrolled(recyclerView, dx, dy);
                if (dy <= 0) {
                    return;
                }
                int visibleCount = layoutManager.getChildCount();
                int totalCount = layoutManager.getItemCount();
                int firstVisible = layoutManager.findFirstVisibleItemPosition();
                if ((visibleCount + firstVisible) >= totalCount - 2) {
                    viewModel.loadMoreOrders();
                }
            }
        });

        chipGroupStatus.setOnCheckedStateChangeListener((group, checkedIds) -> {
            String status = toStatus(checkedIds.isEmpty() ? R.id.chip_all : checkedIds.get(0));
            if (!isSameStatus(status, viewModel.getStatusFilter())) {
                viewModel.setStatusFilter(status);
            }
        });

        swipeRefresh.setOnRefreshListener(() -> viewModel.refreshOrders());

        observeViewModel();
    }

    @Override
    public void onResume() {
        super.onResume();
        if (!hasLoadedOnce) {
            hasLoadedOnce = true;
            viewModel.refreshOrders();
        }
    }

    @Nullable
    private String toStatus(int checkedId) {
        if (checkedId == R.id.chip_pending) return OrderStatusHelper.PENDING;
        if (checkedId == R.id.chip_confirmed) return OrderStatusHelper.CONFIRMED;
        if (checkedId == R.id.chip_shipped) return OrderStatusHelper.SHIPPED;
        if (checkedId == R.id.chip_delivered) return OrderStatusHelper.DELIVERED;
        if (checkedId == R.id.chip_cancelled) return OrderStatusHelper.CANCELLED;
        return null;
    }

    private boolean isSameStatus(@Nullable String a, @Nullable String b) {
        return a == null ? b == null : a.equals(b);
    }

    private void observeViewModel() {
        viewModel.getOrders().observe(getViewLifecycleOwner(), orders -> {
            adapter.setOrders(orders);
            boolean isEmpty = orders == null || orders.isEmpty();
            textEmpty.setText(viewModel.getStatusFilter() == null
                    ? "Bạn chưa có đơn hàng nào\nĐặt món đầu tiên ngay thôi!"
                    : "Không có đơn hàng nào ở trạng thái này");
            textEmpty.setVisibility(isEmpty ? View.VISIBLE : View.GONE);
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
