package com.foodgo_app.ui.admin;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.chip.ChipGroup;
import com.foodgo_app.R;
import com.foodgo_app.adapter.AdminOrderAdapter;
import com.foodgo_app.model.Order;
import com.foodgo_app.ui.order.OrderDetailActivity;
import com.foodgo_app.util.OrderStatusHelper;
import com.foodgo_app.util.SessionManager;

import java.util.List;

public class AdminOrderActivity extends AppCompatActivity {

    private AdminOrderViewModel viewModel;
    private AdminOrderAdapter adapter;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView textEmpty;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin_order);

        // Chan truong hop vao man hinh nay bang tai khoan khong phai admin
        if (!new SessionManager(this).isAdmin()) {
            Toast.makeText(this, "Bạn không có quyền truy cập", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        swipeRefresh = findViewById(R.id.swipe_refresh);
        swipeRefresh.setColorSchemeResources(R.color.colorPrimary);
        progressBar = findViewById(R.id.progress_bar);
        textEmpty = findViewById(R.id.text_empty);
        RecyclerView recyclerOrders = findViewById(R.id.recycler_orders);
        ChipGroup chipGroupStatus = findViewById(R.id.chip_group_status);

        viewModel = new ViewModelProvider(this).get(AdminOrderViewModel.class);

        adapter = new AdminOrderAdapter(this::showUpdateStatusDialog, order -> {
            Intent intent = new Intent(this, OrderDetailActivity.class);
            intent.putExtra("orderId", order.getId());
            startActivity(intent);
        });

        LinearLayoutManager layoutManager = new LinearLayoutManager(this);
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
                    viewModel.loadMore();
                }
            }
        });

        chipGroupStatus.setOnCheckedStateChangeListener((group, checkedIds) -> {
            String status = toStatus(checkedIds.isEmpty() ? R.id.chip_all : checkedIds.get(0));
            if (!isSameStatus(status, viewModel.getStatusFilter())) {
                viewModel.setStatusFilter(status);
            }
        });

        swipeRefresh.setOnRefreshListener(() -> viewModel.refresh());

        observeViewModel();
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Quay lai tu man chi tiet don thi lam moi de thay trang thai moi nhat
        if (viewModel != null) {
            viewModel.refresh();
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

    private void showUpdateStatusDialog(Order order) {
        List<String> nextStatuses = OrderStatusHelper.getNextStatuses(order.getStatus());
        if (nextStatuses.isEmpty()) {
            Toast.makeText(this, "Đơn hàng này đã kết thúc", Toast.LENGTH_SHORT).show();
            return;
        }

        String[] labels = new String[nextStatuses.size()];
        for (int i = 0; i < nextStatuses.size(); i++) {
            labels[i] = OrderStatusHelper.getDisplayName(nextStatuses.get(i));
        }

        new AlertDialog.Builder(this)
                .setTitle("Chuyển trạng thái đơn hàng")
                .setItems(labels, (dialog, which) -> {
                    String target = nextStatuses.get(which);
                    if (OrderStatusHelper.CANCELLED.equals(target)) {
                        confirmCancel(order);
                    } else {
                        viewModel.updateStatus(order.getId(), target);
                    }
                })
                .setNegativeButton("Đóng", null)
                .show();
    }

    private void confirmCancel(Order order) {
        new AlertDialog.Builder(this)
                .setTitle("Hủy đơn hàng")
                .setMessage("Hủy đơn hàng này? Khách hàng sẽ nhận được thông báo và hành động không thể hoàn tác.")
                .setPositiveButton("Hủy đơn", (dialog, which) ->
                        viewModel.updateStatus(order.getId(), OrderStatusHelper.CANCELLED))
                .setNegativeButton("Không", null)
                .show();
    }

    private void observeViewModel() {
        viewModel.getOrders().observe(this, orders -> {
            adapter.setOrders(orders);
            textEmpty.setVisibility(orders == null || orders.isEmpty() ? View.VISIBLE : View.GONE);
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

        viewModel.getUpdateSuccess().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearUpdateSuccess();
            }
        });
    }
}
