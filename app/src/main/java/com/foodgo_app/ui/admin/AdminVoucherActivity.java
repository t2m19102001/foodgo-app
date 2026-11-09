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
import com.foodgo_app.adapter.AdminVoucherAdapter;
import com.foodgo_app.model.Voucher;
import com.foodgo_app.util.SessionManager;

public class AdminVoucherActivity extends AppCompatActivity {

    private AdminVoucherViewModel viewModel;
    private AdminVoucherAdapter adapter;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView textEmpty;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin_voucher);

        if (!new SessionManager(this).isAdmin()) {
            Toast.makeText(this, "Bạn không có quyền truy cập", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setOnMenuItemClickListener(item -> {
            if (item.getItemId() == R.id.action_add) {
                startActivity(new Intent(this, AddEditVoucherActivity.class));
                return true;
            }
            return false;
        });

        swipeRefresh = findViewById(R.id.swipe_refresh);
        swipeRefresh.setColorSchemeResources(R.color.colorPrimary);
        progressBar = findViewById(R.id.progress_bar);
        textEmpty = findViewById(R.id.text_empty);
        RecyclerView recyclerVouchers = findViewById(R.id.recycler_vouchers);

        viewModel = new ViewModelProvider(this).get(AdminVoucherViewModel.class);

        adapter = new AdminVoucherAdapter(new AdminVoucherAdapter.OnVoucherActionListener() {
            @Override
            public void onEdit(Voucher voucher) {
                Intent intent = new Intent(AdminVoucherActivity.this, AddEditVoucherActivity.class);
                intent.putExtra("voucherId", voucher.getId());
                intent.putExtra("code", voucher.getCode());
                intent.putExtra("description", voucher.getDescription());
                intent.putExtra("discountType", voucher.getDiscountType());
                intent.putExtra("discountValue", voucher.getDiscountValue());
                if (voucher.getMaxDiscountAmount() != null) {
                    intent.putExtra("maxDiscountAmount", voucher.getMaxDiscountAmount());
                }
                intent.putExtra("minOrderValue", voucher.getMinOrderValue());
                if (voucher.getUsageLimit() != null) {
                    intent.putExtra("usageLimit", voucher.getUsageLimit());
                }
                if (voucher.getUsageLimitPerUser() != null) {
                    intent.putExtra("usageLimitPerUser", voucher.getUsageLimitPerUser());
                }
                intent.putExtra("validFrom", voucher.getValidFrom());
                intent.putExtra("validUntil", voucher.getValidUntil());
                intent.putExtra("isActive", voucher.isActive());
                startActivity(intent);
            }

            @Override
            public void onDelete(Voucher voucher) {
                confirmDelete(voucher);
            }
        });

        recyclerVouchers.setLayoutManager(new LinearLayoutManager(this));
        recyclerVouchers.setAdapter(adapter);

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

    private void confirmDelete(Voucher voucher) {
        new AlertDialog.Builder(this)
                .setTitle("Xóa mã giảm giá")
                .setMessage("Xóa mã \"" + voucher.getCode() + "\"? Không thể xóa nếu mã đã được khách sử dụng.")
                .setPositiveButton("Xóa", (dialog, which) -> viewModel.deleteVoucher(voucher.getId()))
                .setNegativeButton("Hủy", null)
                .show();
    }

    private void observeViewModel() {
        viewModel.getVouchers().observe(this, vouchers -> {
            adapter.setVouchers(vouchers);
            textEmpty.setVisibility(vouchers == null || vouchers.isEmpty() ? View.VISIBLE : View.GONE);
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
