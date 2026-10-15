package com.foodgo_app.ui.admin;

import android.os.Bundle;
import android.view.View;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.google.android.material.appbar.MaterialToolbar;
import com.foodgo_app.R;
import com.foodgo_app.model.response.OrderStatsResponse;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.OrderStatusHelper;
import com.foodgo_app.util.SessionManager;

import java.util.List;

public class AdminStatsActivity extends AppCompatActivity {

    private AdminStatsViewModel viewModel;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private TextView textTotalRevenue;
    private TextView textTotalOrders;
    private LinearLayout layoutStatusList;
    private LinearLayout layoutDailyList;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin_stats);

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
        textTotalRevenue = findViewById(R.id.text_total_revenue);
        textTotalOrders = findViewById(R.id.text_total_orders);
        layoutStatusList = findViewById(R.id.layout_status_list);
        layoutDailyList = findViewById(R.id.layout_daily_list);

        viewModel = new ViewModelProvider(this).get(AdminStatsViewModel.class);

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

    private void bindStats(OrderStatsResponse stats) {
        if (stats == null) return;
        textTotalRevenue.setText(CurrencyUtils.formatVnd(stats.getTotalRevenue()));
        textTotalOrders.setText("Tổng số đơn: " + stats.getTotalOrders());

        layoutStatusList.removeAllViews();
        List<OrderStatsResponse.StatusCount> byStatus = stats.getByStatus();
        if (byStatus != null) {
            for (int i = 0; i < byStatus.size(); i++) {
                OrderStatsResponse.StatusCount item = byStatus.get(i);
                View row = getLayoutInflater().inflate(R.layout.item_stat_status_row, layoutStatusList, false);
                TextView label = row.findViewById(R.id.text_status_label);
                TextView count = row.findViewById(R.id.text_status_count);
                TextView total = row.findViewById(R.id.text_status_total);
                OrderStatusHelper.applyChip(label, item.getStatus());
                count.setText(item.getCount() + " đơn");
                total.setText(CurrencyUtils.formatVnd(item.getTotal()));
                layoutStatusList.addView(row);
                if (i < byStatus.size() - 1) {
                    layoutStatusList.addView(buildDivider());
                }
            }
        }

        layoutDailyList.removeAllViews();
        List<OrderStatsResponse.DailyRevenue> last7Days = stats.getLast7Days();
        if (last7Days == null || last7Days.isEmpty()) {
            TextView empty = new TextView(this);
            empty.setText("Chưa có đơn giao thành công trong 7 ngày gần nhất");
            empty.setTextColor(getColor(R.color.text_secondary));
            layoutDailyList.addView(empty);
        } else {
            for (int i = 0; i < last7Days.size(); i++) {
                OrderStatsResponse.DailyRevenue item = last7Days.get(i);
                View row = getLayoutInflater().inflate(R.layout.item_stat_daily_row, layoutDailyList, false);
                TextView date = row.findViewById(R.id.text_daily_date);
                TextView revenue = row.findViewById(R.id.text_daily_revenue);
                date.setText(item.getDate() + " (" + item.getCount() + " đơn)");
                revenue.setText(CurrencyUtils.formatVnd(item.getRevenue()));
                layoutDailyList.addView(row);
                if (i < last7Days.size() - 1) {
                    layoutDailyList.addView(buildDivider());
                }
            }
        }
    }

    private View buildDivider() {
        View divider = new View(this);
        divider.setLayoutParams(new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 1));
        divider.setBackgroundColor(getColor(R.color.divider));
        return divider;
    }

    private void observeViewModel() {
        viewModel.getStats().observe(this, this::bindStats);

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
    }
}
