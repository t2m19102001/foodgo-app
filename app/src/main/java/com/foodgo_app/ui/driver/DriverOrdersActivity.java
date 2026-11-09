package com.foodgo_app.ui.driver;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.ContextCompat;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.adapter.DriverOrderAdapter;
import com.foodgo_app.ui.map.DeliveryMapActivity;
import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;

// Chia se vi tri CHI khi Activity dang o foreground (xin quyen
// ACCESS_FINE_LOCATION runtime, KHONG dung ACCESS_BACKGROUND_LOCATION) -
// Handler lap moi 10s, dung ngay khi roi Activity hoac tat Switch.
public class DriverOrdersActivity extends AppCompatActivity {

    private static final long LOCATION_INTERVAL_MS = 10000;

    private DriverOrdersViewModel viewModel;
    private DriverOrderAdapter adapter;
    private FusedLocationProviderClient fusedLocationClient;
    private SwitchCompat switchShareLocation;
    private View textEmpty;
    private View progressBar;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable locationRunnable = new Runnable() {
        @Override
        public void run() {
            pushCurrentLocation();
            handler.postDelayed(this, LOCATION_INTERVAL_MS);
        }
    };

    private final ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) {
                    startSharingLocation();
                } else {
                    switchShareLocation.setChecked(false);
                    Toast.makeText(this, "Cần quyền vị trí để chia sẻ vị trí cho khách hàng", Toast.LENGTH_SHORT).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_driver_orders);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);
        switchShareLocation = findViewById(R.id.switch_share_location);
        textEmpty = findViewById(R.id.text_empty);
        progressBar = findViewById(R.id.progress_bar);

        RecyclerView recyclerOrders = findViewById(R.id.recycler_orders);
        adapter = new DriverOrderAdapter(order -> {
            Intent intent = new Intent(this, DeliveryMapActivity.class);
            intent.putExtra("orderId", order.getId());
            startActivity(intent);
        });
        recyclerOrders.setLayoutManager(new LinearLayoutManager(this));
        recyclerOrders.setAdapter(adapter);

        switchShareLocation.setOnCheckedChangeListener((buttonView, isChecked) -> {
            if (isChecked) {
                requestLocationPermissionAndStart();
            } else {
                handler.removeCallbacks(locationRunnable);
            }
        });

        viewModel = new ViewModelProvider(this).get(DriverOrdersViewModel.class);
        observeViewModel();
    }

    @Override
    protected void onResume() {
        super.onResume();
        viewModel.loadMyDeliveries();
        if (switchShareLocation.isChecked()) {
            handler.postDelayed(locationRunnable, LOCATION_INTERVAL_MS);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        handler.removeCallbacks(locationRunnable);
    }

    private void requestLocationPermissionAndStart() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
            return;
        }
        startSharingLocation();
    }

    private void startSharingLocation() {
        handler.removeCallbacks(locationRunnable);
        pushCurrentLocation();
        handler.postDelayed(locationRunnable, LOCATION_INTERVAL_MS);
    }

    @SuppressWarnings("MissingPermission") // da kiem checkSelfPermission truoc khi bat Switch
    private void pushCurrentLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            if (location != null) {
                viewModel.updateLocation(location.getLatitude(), location.getLongitude());
            }
        });
    }

    private void observeViewModel() {
        viewModel.getOrders().observe(this, orders -> {
            adapter.setOrders(orders);
            textEmpty.setVisibility(orders == null || orders.isEmpty() ? View.VISIBLE : View.GONE);
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
