package com.foodgo_app.ui.cart;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.RadioButton;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.google.android.material.dialog.MaterialAlertDialogBuilder;
import com.foodgo_app.R;
import com.foodgo_app.adapter.CartSummaryAdapter;
import com.foodgo_app.model.SavedAddress;
import com.foodgo_app.ui.address.AddEditAddressActivity;
import com.foodgo_app.ui.address.AddressListActivity;
import com.foodgo_app.ui.order.OrderTrackingActivity;
import com.foodgo_app.util.CurrencyUtils;

public class CheckoutActivity extends AppCompatActivity {

    private static final int REQUEST_PICK_ADDRESS = 2001;
    private static final int REQUEST_ADD_ADDRESS = 2002;

    private CheckoutViewModel viewModel;
    private CartSummaryAdapter summaryAdapter;

    private TextView textTotal;
    private TextView textError;
    private MaterialButton btnPlaceOrder;
    private android.widget.ProgressBar progressBar;
    private View cardPaymentCod;
    private View cardPaymentVnpay;
    private View cardPaymentZalopay;
    private RadioButton radioPaymentCod;
    private RadioButton radioPaymentVnpay;
    private RadioButton radioPaymentZalopay;

    private MaterialButton btnChangeAddress;
    private MaterialButton btnAddAddress;
    private View layoutAddressFilled;
    private View layoutAddressEmpty;
    private TextView textAddressName;
    private TextView textAddressDetail;
    private TextView textAddressNote;
    private TextView textPendingStatus;
    private View layoutPendingActions;
    private MaterialButton btnResumePayment;
    private boolean isLoading;
    private boolean hasSelectedAddress;
    private boolean hasPending;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_checkout);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        textTotal = findViewById(R.id.text_total);
        textError = findViewById(R.id.text_error);
        btnPlaceOrder = findViewById(R.id.btn_place_order);
        progressBar = findViewById(R.id.progress_bar);
        RecyclerView recyclerSummary = findViewById(R.id.recycler_summary);

        btnChangeAddress = findViewById(R.id.btn_change_address);
        btnAddAddress = findViewById(R.id.btn_add_address);
        layoutAddressFilled = findViewById(R.id.layout_address_filled);
        layoutAddressEmpty = findViewById(R.id.layout_address_empty);
        textAddressName = findViewById(R.id.text_address_name);
        textAddressDetail = findViewById(R.id.text_address_detail);
        textAddressNote = findViewById(R.id.text_address_note);

        btnChangeAddress.setOnClickListener(v -> {
            Intent intent = new Intent(this, AddressListActivity.class);
            intent.putExtra("pickMode", true);
            startActivityForResult(intent, REQUEST_PICK_ADDRESS);
        });
        btnAddAddress.setOnClickListener(v ->
                startActivityForResult(new Intent(this, AddEditAddressActivity.class), REQUEST_ADD_ADDRESS));

        cardPaymentCod = findViewById(R.id.card_payment_cod);
        cardPaymentVnpay = findViewById(R.id.card_payment_vnpay);
        cardPaymentZalopay = findViewById(R.id.card_payment_zalopay);
        radioPaymentCod = findViewById(R.id.radio_payment_cod);
        radioPaymentVnpay = findViewById(R.id.radio_payment_vnpay);
        radioPaymentZalopay = findViewById(R.id.radio_payment_zalopay);
        cardPaymentCod.setOnClickListener(v -> selectPaymentMethod("cod"));
        cardPaymentVnpay.setOnClickListener(v -> selectPaymentMethod("vnpay"));
        cardPaymentZalopay.setOnClickListener(v -> selectPaymentMethod("zalopay"));

        summaryAdapter = new CartSummaryAdapter();
        recyclerSummary.setLayoutManager(new LinearLayoutManager(this));
        recyclerSummary.setAdapter(summaryAdapter);

        viewModel = new ViewModelProvider(this).get(CheckoutViewModel.class);

        btnPlaceOrder.setOnClickListener(v -> viewModel.placeOrder(selectedPaymentMethod()));

        textPendingStatus = findViewById(R.id.text_pending_status);
        layoutPendingActions = findViewById(R.id.layout_pending_actions);
        btnResumePayment = findViewById(R.id.btn_resume_payment);
        btnResumePayment.setOnClickListener(v -> {
            String url = viewModel.getResumePayUrl().getValue();
            if (url != null && !url.isEmpty()) openPayment(url);
        });
        findViewById(R.id.btn_cancel_pending).setOnClickListener(v ->
                new MaterialAlertDialogBuilder(this)
                        .setTitle("Hủy thanh toán?")
                        .setMessage("Đơn đang chờ thanh toán sẽ bị hủy, giỏ hàng vẫn được giữ nguyên để bạn chọn phương thức khác. "
                                + "Nếu bạn đã thanh toán, hãy bấm \"Kiểm tra / thanh toán lại\" trước.")
                        .setNegativeButton("Không", null)
                        .setPositiveButton("Hủy thanh toán", (dialog, which) -> viewModel.abandonPendingOrder())
                        .show());

        observeViewModel();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK) return;
        if (requestCode == REQUEST_PICK_ADDRESS && data != null) {
            String addressId = data.getStringExtra("addressId");
            if (addressId != null) viewModel.selectAddress(addressId);
        } else if (requestCode == REQUEST_ADD_ADDRESS) {
            viewModel.loadAddresses();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Quay lai tu trinh duyet VNPay (hoac mo lai man hinh): cap nhat trang
        // thai don dang cho, khong tu gui lai don
        viewModel.refreshPendingStatus();
    }

    private void openPayment(String payUrl) {
        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(payUrl)));
    }

    private void selectPaymentMethod(String method) {
        if (hasPending) return;
        radioPaymentCod.setChecked("cod".equals(method));
        radioPaymentVnpay.setChecked("vnpay".equals(method));
        radioPaymentZalopay.setChecked("zalopay".equals(method));
    }

    private String selectedPaymentMethod() {
        if (radioPaymentVnpay.isChecked()) return "vnpay";
        if (radioPaymentZalopay.isChecked()) return "zalopay";
        return "cod";
    }

    private void observeViewModel() {
        viewModel.getCartItems().observe(this, summaryAdapter::setItems);

        viewModel.getTotalAmount().observe(this, total ->
                textTotal.setText(CurrencyUtils.formatVnd(total != null ? total : 0)));

        viewModel.getLoading().observe(this, loadingValue -> {
            isLoading = Boolean.TRUE.equals(loadingValue);
            progressBar.setVisibility(isLoading ? View.VISIBLE : View.GONE);
            updatePlaceOrderButtonState();
        });

        viewModel.getHasPendingOrder().observe(this, pending -> {
            hasPending = Boolean.TRUE.equals(pending);
            btnPlaceOrder.setText(hasPending ? "Kiểm tra / thanh toán lại" : "Đặt hàng");
            layoutPendingActions.setVisibility(hasPending ? View.VISIBLE : View.GONE);
            // Dang cho thanh toan thi khong doi phuong thuc tai cho: phai huy truoc
            float alpha = hasPending ? 0.5f : 1f;
            cardPaymentCod.setAlpha(alpha);
            cardPaymentVnpay.setAlpha(alpha);
            cardPaymentZalopay.setAlpha(alpha);
            updatePlaceOrderButtonState();
        });

        viewModel.getPendingStatus().observe(this, status -> {
            boolean show = status != null && !status.isEmpty();
            textPendingStatus.setText(status);
            textPendingStatus.setVisibility(show ? View.VISIBLE : View.GONE);
        });

        viewModel.getResumePayUrl().observe(this, url ->
                btnResumePayment.setVisibility(url != null && !url.isEmpty() ? View.VISIBLE : View.GONE));

        viewModel.getInfo().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_LONG).show();
                textError.setVisibility(View.GONE);
                viewModel.clearInfo();
            }
        });

        viewModel.getSelectedAddress().observe(this, this::bindAddress);

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        // VNPay/ZaloPay: don chua "ton tai" voi khach cho den khi thanh toan xong,
        // nen o day KHONG dieu huong, KHONG bao thanh cong - chi mo trinh duyet.
        // Khi khach quay lai, onResume tu kiem tra trang thai (refreshPendingStatus).
        viewModel.getPendingPayUrl().observe(this, payUrl -> {
            if (payUrl != null && !payUrl.isEmpty()) {
                Toast.makeText(this, "Đang chuyển đến trang thanh toán…", Toast.LENGTH_SHORT).show();
                openPayment(payUrl);
                viewModel.clearPendingPayUrl();
            }
        });

        // placedOrderId chi duoc set khi don THAT SU ton tai: COD ngay luc dat,
        // hoac VNPay sau khi da thanh toan thanh cong. Ca hai truong hop deu dung
        // noi "Dat hang thanh cong" vi luc nay no moi la su that.
        viewModel.getPlacedOrderId().observe(this, orderId -> {
            if (orderId != null && !orderId.isEmpty()) {
                Toast.makeText(this, "Đặt hàng thành công", Toast.LENGTH_SHORT).show();
                Intent intent = new Intent(this, OrderTrackingActivity.class);
                intent.putExtra("orderId", orderId);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            }
        });
    }

    private void bindAddress(SavedAddress address) {
        hasSelectedAddress = address != null;
        layoutAddressFilled.setVisibility(hasSelectedAddress ? View.VISIBLE : View.GONE);
        layoutAddressEmpty.setVisibility(hasSelectedAddress ? View.GONE : View.VISIBLE);
        btnChangeAddress.setVisibility(hasSelectedAddress ? View.VISIBLE : View.GONE);
        updatePlaceOrderButtonState();

        if (!hasSelectedAddress) return;
        textAddressName.setText(address.getFullName() + " - " + address.getPhone());
        textAddressDetail.setText(address.getAddress());
        boolean hasNote = !TextUtils.isEmpty(address.getNote());
        textAddressNote.setText(address.getNote());
        textAddressNote.setVisibility(hasNote ? View.VISIBLE : View.GONE);
    }

    private void updatePlaceOrderButtonState() {
        // Don dang cho thi dung yeu cau da luu, khong can dia chi dang chon
        btnPlaceOrder.setEnabled(!isLoading && (hasSelectedAddress || hasPending));
        findViewById(R.id.btn_cancel_pending).setEnabled(!isLoading);
        btnResumePayment.setEnabled(!isLoading);
    }
}
