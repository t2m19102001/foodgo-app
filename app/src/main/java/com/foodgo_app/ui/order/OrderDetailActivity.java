package com.foodgo_app.ui.order;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.foodgo_app.R;
import com.foodgo_app.util.DateUtils;
import com.foodgo_app.adapter.OrderItemAdapter;
import com.foodgo_app.model.Order;
import com.foodgo_app.ui.review.AddEditReviewActivity;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.OrderStatusHelper;
import com.foodgo_app.util.PaymentStatusHelper;
import com.foodgo_app.util.SessionManager;

public class OrderDetailActivity extends AppCompatActivity {

    private OrderViewModel viewModel;
    private OrderItemAdapter itemAdapter;
    private String orderId;

    private TextView textOrderCode;
    private TextView textStatus;
    private TextView textDate;
    private TextView textReceiver;
    private TextView textAddress;
    private TextView textNote;
    private TextView textAmount;
    private TextView textPaymentCaption;
    private TextView textPaymentStatus;
    private TextView textCancelReason;
    private MaterialButton btnCancelOrder;
    private MaterialButton btnTrackOrder;
    private android.widget.ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_detail);

        orderId = getIntent().getStringExtra("orderId");
        if (orderId == null) {
            Toast.makeText(this, "Không tìm thấy đơn hàng", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        textOrderCode = findViewById(R.id.text_order_code);
        textStatus = findViewById(R.id.text_status);
        textDate = findViewById(R.id.text_date);
        textReceiver = findViewById(R.id.text_receiver);
        textAddress = findViewById(R.id.text_address);
        textNote = findViewById(R.id.text_note);
        textAmount = findViewById(R.id.text_amount);
        textPaymentCaption = findViewById(R.id.text_payment_caption);
        textPaymentStatus = findViewById(R.id.text_payment_status);
        textCancelReason = findViewById(R.id.text_cancel_reason);
        btnCancelOrder = findViewById(R.id.btn_cancel_order);
        btnTrackOrder = findViewById(R.id.btn_track_order);
        progressBar = findViewById(R.id.progress_bar);
        RecyclerView recyclerItems = findViewById(R.id.recycler_items);

        // Mon trong don da giao co them nut danh gia
        itemAdapter = new OrderItemAdapter(item -> {
            Intent reviewIntent = new Intent(this, AddEditReviewActivity.class);
            reviewIntent.putExtra("foodId", item.getFoodId());
            reviewIntent.putExtra("foodName", item.getName());
            startActivity(reviewIntent);
        });
        recyclerItems.setLayoutManager(new LinearLayoutManager(this));
        recyclerItems.setAdapter(itemAdapter);

        viewModel = new ViewModelProvider(this).get(OrderViewModel.class);

        btnCancelOrder.setOnClickListener(v -> showCancelDialog());
        btnTrackOrder.setOnClickListener(v -> {
            Intent intent = new Intent(this, OrderTrackingActivity.class);
            intent.putExtra("orderId", orderId);
            startActivity(intent);
        });

        observeViewModel();
        viewModel.loadOrderDetail(orderId);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (orderId != null) {
            viewModel.loadOrderDetail(orderId);
        }
    }

    private void showCancelDialog() {
        final EditText input = new EditText(this);
        input.setHint("Nhập lý do hủy đơn");
        int padding = (int) (16 * getResources().getDisplayMetrics().density);
        input.setPadding(padding, padding, padding, padding);

        new AlertDialog.Builder(this)
                .setTitle("Hủy đơn hàng")
                .setMessage("Bạn có chắc chắn muốn hủy đơn hàng này?")
                .setView(input)
                .setPositiveButton("Xác nhận", (dialog, which) -> {
                    String reason = input.getText() != null ? input.getText().toString().trim() : "";
                    if (TextUtils.isEmpty(reason)) {
                        reason = "Khách hàng hủy đơn";
                    }
                    viewModel.cancelOrder(orderId, reason);
                })
                .setNegativeButton("Đóng", null)
                .show();
    }

    private void observeViewModel() {
        viewModel.getOrderDetail().observe(this, this::bindOrder);

        viewModel.getLoading().observe(this, isLoading ->
                progressBar.setVisibility(Boolean.TRUE.equals(isLoading) ? View.VISIBLE : View.GONE));

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getCancelSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, "Đã hủy đơn hàng thành công", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void bindOrder(Order order) {
        if (order == null) {
            return;
        }
        String id = order.getId() != null ? order.getId() : "";
        String shortId = id.length() > 8 ? id.substring(id.length() - 8) : id;
        textOrderCode.setText("Đơn hàng #" + shortId);
        OrderStatusHelper.applyChip(textStatus, order.getStatus());
        textDate.setText("Đặt lúc " + DateUtils.format(order.getDate()));
        textAmount.setText(CurrencyUtils.formatVnd(order.getAmount()));
        textPaymentCaption.setText("vnpay".equals(order.getPaymentMethod())
                ? "Thanh toán online qua VNPay" : "Thanh toán khi nhận hàng (COD)");
        PaymentStatusHelper.applyChip(textPaymentStatus, order.getPaymentStatus());
        itemAdapter.setItems(order.getItems());
        itemAdapter.setReviewEnabled(OrderStatusHelper.DELIVERED.equals(order.getStatus()));

        if (order.getAddress() != null) {
            textReceiver.setText(order.getAddress().getFullName() + " - " + order.getAddress().getPhone());
            textAddress.setText(order.getAddress().getAddress());
            if (!TextUtils.isEmpty(order.getAddress().getNote())) {
                textNote.setText("Ghi chú: " + order.getAddress().getNote());
                textNote.setVisibility(View.VISIBLE);
            } else {
                textNote.setVisibility(View.GONE);
            }
        }

        if (!TextUtils.isEmpty(order.getCancelReason())) {
            textCancelReason.setText("Lý do hủy: " + order.getCancelReason());
            textCancelReason.setVisibility(View.VISIBLE);
        } else {
            textCancelReason.setVisibility(View.GONE);
        }

        // Chi chu don moi huy duoc (backend chan admin huy don cua nguoi khac),
        // admin xem don cua khach thi khong hien nut nay
        String currentUserId = new SessionManager(this).getUserId();
        boolean isOwner = currentUserId != null && currentUserId.equals(order.getUserId());
        btnCancelOrder.setVisibility(order.isCancellable() && isOwner ? View.VISIBLE : View.GONE);
        btnTrackOrder.setVisibility("cancelled".equals(order.getStatus()) ? View.GONE : View.VISIBLE);
    }
}
