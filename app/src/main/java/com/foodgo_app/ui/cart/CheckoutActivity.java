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
    private RadioButton radioPaymentCod;
    private RadioButton radioPaymentVnpay;

    private MaterialButton btnChangeAddress;
    private MaterialButton btnAddAddress;
    private View layoutAddressFilled;
    private View layoutAddressEmpty;
    private TextView textAddressName;
    private TextView textAddressDetail;
    private TextView textAddressNote;
    private boolean isLoading;
    private boolean hasSelectedAddress;

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
        radioPaymentCod = findViewById(R.id.radio_payment_cod);
        radioPaymentVnpay = findViewById(R.id.radio_payment_vnpay);
        cardPaymentCod.setOnClickListener(v -> selectPaymentMethod(true));
        cardPaymentVnpay.setOnClickListener(v -> selectPaymentMethod(false));

        summaryAdapter = new CartSummaryAdapter();
        recyclerSummary.setLayoutManager(new LinearLayoutManager(this));
        recyclerSummary.setAdapter(summaryAdapter);

        viewModel = new ViewModelProvider(this).get(CheckoutViewModel.class);

        btnPlaceOrder.setOnClickListener(v -> viewModel.placeOrder(
                radioPaymentVnpay.isChecked() ? "vnpay" : "cod"
        ));

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

    private void selectPaymentMethod(boolean isCod) {
        radioPaymentCod.setChecked(isCod);
        radioPaymentVnpay.setChecked(!isCod);
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

        viewModel.getHasPendingOrder().observe(this, pending -> btnPlaceOrder.setText(
                Boolean.TRUE.equals(pending) ? "Kiểm tra / thử lại đơn" : "Đặt hàng"));

        viewModel.getSelectedAddress().observe(this, this::bindAddress);

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                textError.setText(message);
                textError.setVisibility(View.VISIBLE);
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getVnpayPayUrl().observe(this, payUrl -> {
            if (payUrl != null && !payUrl.isEmpty()) {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(payUrl)));
                viewModel.clearVnpayPayUrl();
            }
        });

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
        btnPlaceOrder.setEnabled(!isLoading && hasSelectedAddress);
    }
}
