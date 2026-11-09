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
import com.foodgo_app.model.EtaInfo;
import com.foodgo_app.model.Order;
import com.foodgo_app.ui.main.MainActivity;
import com.foodgo_app.ui.map.DeliveryMapActivity;
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
    private View cardEta;
    private TextView textEtaTotal;
    private TextView textEtaConfirm;
    private TextView textEtaPrep;
    private TextView textEtaDelivery;
    private TextView textEtaWarning;
    private View btnViewMap;

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
        cardEta = findViewById(R.id.card_eta);
        textEtaTotal = findViewById(R.id.text_eta_total);
        textEtaConfirm = findViewById(R.id.text_eta_confirm);
        textEtaPrep = findViewById(R.id.text_eta_prep);
        textEtaDelivery = findViewById(R.id.text_eta_delivery);
        textEtaWarning = findViewById(R.id.text_eta_warning);
        btnViewMap = findViewById(R.id.btn_view_map);
        btnViewMap.setOnClickListener(v -> {
            Intent intent = new Intent(this, DeliveryMapActivity.class);
            intent.putExtra("orderId", orderId);
            startActivity(intent);
        });

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
            cardEta.setVisibility(View.GONE);
            btnViewMap.setVisibility(View.GONE);
            handler.removeCallbacksAndMessages(null);
            return;
        }

        textCancelledNotice.setVisibility(View.GONE);
        stepPending.setVisibility(View.VISIBLE);
        stepConfirmed.setVisibility(View.VISIBLE);
        stepShipped.setVisibility(View.VISIBLE);
        stepDelivered.setVisibility(View.VISIBLE);
        btnViewMap.setVisibility(order.hasShipCoordinates() ? View.VISIBLE : View.GONE);
        bindEta(order.getEta());

        int activeStep = stepIndex(status);
        highlightStep(stepPending, 0, activeStep);
        highlightStep(stepConfirmed, 1, activeStep);
        highlightStep(stepShipped, 2, activeStep);
        highlightStep(stepDelivered, 3, activeStep);

        if ("delivered".equals(status)) {
            handler.removeCallbacksAndMessages(null);
        }
    }

    // eta la null voi don dat truoc khi co Smart ETA (xem model/EtaInfo.java)
    private void bindEta(EtaInfo eta) {
        if (eta == null) {
            cardEta.setVisibility(View.GONE);
            return;
        }
        cardEta.setVisibility(View.VISIBLE);
        textEtaTotal.setText("Dự kiến giao trong khoảng " + eta.getTotalMinutes() + " phút");
        textEtaConfirm.setText("Xác nhận đơn: ~" + eta.getConfirmMinutes() + " phút");
        textEtaPrep.setText("Chuẩn bị món: ~" + eta.getPrepMinutes() + " phút");
        textEtaDelivery.setText("Giao hàng: ~" + eta.getDeliveryMinutes() + " phút");
        if (eta.isDelayed()) {
            textEtaWarning.setVisibility(View.VISIBLE);
            textEtaWarning.setText("Quán đang đông đơn, có thể trễ thêm khoảng "
                    + eta.getDelayMinutes() + " phút so với dự kiến ban đầu");
        } else {
            textEtaWarning.setVisibility(View.GONE);
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
