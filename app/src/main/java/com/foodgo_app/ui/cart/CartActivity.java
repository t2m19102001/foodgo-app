package com.foodgo_app.ui.cart;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.foodgo_app.R;
import com.foodgo_app.adapter.CartAdapter;
import com.foodgo_app.model.CartItem;
import com.foodgo_app.util.CurrencyUtils;

public class CartActivity extends AppCompatActivity {

    private CartViewModel viewModel;
    private CartAdapter adapter;
    private TextView textTotal;
    private TextView textEmpty;
    private MaterialButton btnCheckout;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_cart);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        RecyclerView recyclerCart = findViewById(R.id.recycler_cart);
        textTotal = findViewById(R.id.text_total);
        textEmpty = findViewById(R.id.text_empty);
        btnCheckout = findViewById(R.id.btn_checkout);

        viewModel = new ViewModelProvider(this).get(CartViewModel.class);

        adapter = new CartAdapter(new CartAdapter.OnCartActionListener() {
            @Override
            public void onIncrease(CartItem item) {
                viewModel.updateQuantity(item.getFood().getId(), item.getQuantity() + 1);
            }

            @Override
            public void onDecrease(CartItem item) {
                int newQuantity = item.getQuantity() - 1;
                if (newQuantity <= 0) {
                    viewModel.removeItem(item.getFood().getId());
                } else {
                    viewModel.updateQuantity(item.getFood().getId(), newQuantity);
                }
            }

            @Override
            public void onRemove(CartItem item) {
                viewModel.removeItem(item.getFood().getId());
            }
        });
        recyclerCart.setLayoutManager(new LinearLayoutManager(this));
        recyclerCart.setAdapter(adapter);

        btnCheckout.setOnClickListener(v ->
                startActivity(new Intent(this, CheckoutActivity.class)));

        observeViewModel();
    }

    @Override
    protected void onResume() {
        super.onResume();
        viewModel.reload();
    }

    private void observeViewModel() {
        viewModel.getCartItems().observe(this, items -> {
            adapter.setItems(items);
            boolean empty = items == null || items.isEmpty();
            textEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
            btnCheckout.setEnabled(!empty);
        });

        viewModel.getTotalAmount().observe(this, total ->
                textTotal.setText(CurrencyUtils.formatVnd(total != null ? total : 0)));
    }
}
