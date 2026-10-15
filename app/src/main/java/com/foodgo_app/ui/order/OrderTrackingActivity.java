package com.foodgo_app.ui.order;

import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;

import com.foodgo_app.R;
import com.foodgo_app.model.Order;
import com.foodgo_app.ui.main.MainActivity;
import com.foodgo_app.util.OrderStatusHelper;
import com.foodgo_app.util.PaymentStatusHelper;

public class OrderTrackingActivity extends AppCompatActivity {

    private static final long POLL_INTERVAL_MS = 5000;

    private OrderViewModel viewModel;
    private String orderId;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pollRunnable;

    private TextView textOrderCode;
    private TextView textCurrentStatus;
    private TextView textPaymentStatus;
    private TextView textCancelledNotice;
    private TextView stepPending;
    private TextView stepConfirmed;
    private TextView stepShipped;
    private TextView stepDelivered;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_order_tracking);

        orderId = getIntent().getStringExtra("orderId");
        if (orderId == null) {
            Toast.makeText(this, "Không tìm thấy đơn hàng", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        textOrderCode = findViewById(R.id.text_order_code);
        textCurrentStatus = findViewById(R.id.text_current_status);
        textPaymentStatus = findViewById(R.id.text_payment_status);
        textCancelledNotice = findViewById(R.id.text_cancelled_notice);
        stepPending = findViewById(R.id.step_pending);
        stepConfirmed = findViewById(R.id.step_confirmed);
        stepShipped = findViewById(R.id.step_shipped);
        stepDelivered = findViewById(R.id.step_delivered);

        String shortId = orderId.length() > 8 ? orderId.substring(orderId.length() - 8) : orderId;
        textOrderCode.setText("Đơn hàng #" + shortId);

        findViewById(R.id.btn_go_home).setOnClickListener(v -> {
            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            finish();
        });

        viewModel = new ViewModelProvider(this).get(OrderViewModel.class);
        viewModel.getOrderDetail().observe(this, this::bindOrder);
        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        pollRunnable = () -> {
            viewModel.loadOrderDetail(orderId);
            handler.postDelayed(pollRunnable, POLL_INTERVAL_MS);
        };
    }

    @Override
    protected void onResume() {
        super.onResume();
        viewModel.loadOrderDetail(orderId);
        handler.postDelayed(pollRunnable, POLL_INTERVAL_MS);
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacksAndMessages(null);
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        handler.removeCallbacksAndMessages(null);
    }

    private void bindOrder(Order order) {
        if (order == null) {
            return;
        }
        String status = order.getStatus();
        textCurrentStatus.setText(OrderStatusHelper.getDisplayName(status));
        textCurrentStatus.setTextColor(OrderStatusHelper.getColor(this, status));
        PaymentStatusHelper.applyChip(textPaymentStatus, order.getPaymentStatus());

        if ("cancelled".equals(status)) {
            textCancelledNotice.setVisibility(View.VISIBLE);
            stepPending.setVisibility(View.GONE);
            stepConfirmed.setVisibility(View.GONE);
            stepShipped.setVisibility(View.GONE);
            stepDelivered.setVisibility(View.GONE);
            handler.removeCallbacksAndMessages(null);
            return;
        }

        textCancelledNotice.setVisibility(View.GONE);
        stepPending.setVisibility(View.VISIBLE);
        stepConfirmed.setVisibility(View.VISIBLE);
        stepShipped.setVisibility(View.VISIBLE);
        stepDelivered.setVisibility(View.VISIBLE);

        int activeStep = stepIndex(status);
        highlightStep(stepPending, 0, activeStep);
        highlightStep(stepConfirmed, 1, activeStep);
        highlightStep(stepShipped, 2, activeStep);
        highlightStep(stepDelivered, 3, activeStep);

        if ("delivered".equals(status)) {
            handler.removeCallbacksAndMessages(null);
        }
    }

    private int stepIndex(String status) {
        if (status == null) return -1;
        switch (status) {
            case "pending": return 0;
            case "confirmed": return 1;
            case "shipped": return 2;
            case "delivered": return 3;
            default: return -1;
        }
    }

    // Nen, icon va mau chu cua buoc doi theo trang thai selected (xem drawable/bg_step, ic_step_state, color/step_text)
    private void highlightStep(TextView view, int index, int activeStep) {
        boolean done = index <= activeStep;
        view.setSelected(done);
        view.setTypeface(null, done ? android.graphics.Typeface.BOLD : android.graphics.Typeface.NORMAL);
    }
}
