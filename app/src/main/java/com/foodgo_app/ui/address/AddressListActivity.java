package com.foodgo_app.ui.address;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.google.gson.Gson;
import com.foodgo_app.R;
import com.foodgo_app.adapter.AddressAdapter;
import com.foodgo_app.model.SavedAddress;

public class AddressListActivity extends AppCompatActivity {

    private static final int REQUEST_ADD_EDIT_ADDRESS = 1001;

    private AddressViewModel viewModel;
    private AddressAdapter adapter;
    private TextView textEmpty;
    private android.widget.ProgressBar progressBar;
    private boolean pickMode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_address_list);

        pickMode = getIntent().getBooleanExtra("pickMode", false);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        if (pickMode) {
            toolbar.setTitle("Chọn địa chỉ giao hàng");
        }

        RecyclerView recyclerAddresses = findViewById(R.id.recycler_addresses);
        textEmpty = findViewById(R.id.text_empty);
        progressBar = findViewById(R.id.progress_bar);

        viewModel = new ViewModelProvider(this).get(AddressViewModel.class);

        adapter = new AddressAdapter(new AddressAdapter.OnAddressActionListener() {
            @Override
            public void onSelect(SavedAddress address) {
                if (pickMode) {
                    Intent result = new Intent();
                    result.putExtra("addressId", address.getId());
                    setResult(RESULT_OK, result);
                    finish();
                } else {
                    openEdit(address);
                }
            }

            @Override
            public void onSetDefault(SavedAddress address) {
                viewModel.setDefault(address.getId());
            }

            @Override
            public void onEdit(SavedAddress address) {
                openEdit(address);
            }

            @Override
            public void onDelete(SavedAddress address) {
                new AlertDialog.Builder(AddressListActivity.this)
                        .setTitle("Xóa địa chỉ")
                        .setMessage("Bạn có chắc chắn muốn xóa địa chỉ này?")
                        .setPositiveButton("Xóa", (dialog, which) -> viewModel.delete(address.getId()))
                        .setNegativeButton("Đóng", null)
                        .show();
            }
        });
        recyclerAddresses.setLayoutManager(new LinearLayoutManager(this));
        recyclerAddresses.setAdapter(adapter);

        findViewById(R.id.btn_add_address).setOnClickListener(v ->
                startActivityForResult(new Intent(this, AddEditAddressActivity.class), REQUEST_ADD_EDIT_ADDRESS));

        observeViewModel();
        viewModel.loadAddresses();
    }

    private void openEdit(SavedAddress address) {
        Intent intent = new Intent(this, AddEditAddressActivity.class);
        intent.putExtra("addressJson", new Gson().toJson(address));
        startActivityForResult(intent, REQUEST_ADD_EDIT_ADDRESS);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQUEST_ADD_EDIT_ADDRESS && resultCode == RESULT_OK) {
            viewModel.loadAddresses();
        }
    }

    private void observeViewModel() {
        viewModel.getAddresses().observe(this, addresses -> {
            adapter.setAddresses(addresses);
            textEmpty.setVisibility(addresses == null || addresses.isEmpty() ? View.VISIBLE : View.GONE);
        });

        viewModel.getLoading().observe(this, isLoading ->
                progressBar.setVisibility(Boolean.TRUE.equals(isLoading) ? View.VISIBLE : View.GONE));

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });
    }
}
