package com.foodgo_app.ui.map;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.BitmapDescriptorFactory;
import com.google.android.gms.maps.model.LatLng;
import com.google.android.gms.maps.model.LatLngBounds;
import com.google.android.gms.maps.model.Marker;
import com.google.android.gms.maps.model.MarkerOptions;
import com.foodgo_app.R;
import com.foodgo_app.model.DriverLocation;
import com.foodgo_app.model.Order;
import com.foodgo_app.model.response.RestaurantLocationResponse;
import com.foodgo_app.repository.RestaurantRepository;
import com.foodgo_app.ui.order.OrderViewModel;
import com.foodgo_app.util.DistanceUtils;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

// Dung CHUNG cho module Maps (xem tuyen giao: nha hang + diem den) va module
// Location Sharing (them marker tai xe khi dang 'shipped') - tranh viet 2
// man hinh ban do rieng. Tu poll lai don moi 5s giong dung pattern cua
// OrderTrackingActivity de marker tai xe cap nhat lien tuc khi dang mo man nay.
public class DeliveryMapActivity extends AppCompatActivity implements OnMapReadyCallback {

    private static final long POLL_INTERVAL_MS = 5000;

    private OrderViewModel viewModel;
    private RestaurantRepository restaurantRepository;
    private GoogleMap map;
    private TextView textDistance;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private Runnable pollRunnable;
    private String orderId;

    private LatLng restaurantLatLng;
    private Marker restaurantMarker;
    private Marker destinationMarker;
    private Marker driverMarker;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_delivery_map);

        orderId = getIntent().getStringExtra("orderId");
        if (orderId == null) {
            Toast.makeText(this, "Không tìm thấy đơn hàng", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        textDistance = findViewById(R.id.text_distance);

        restaurantRepository = new RestaurantRepository(this);
        viewModel = new ViewModelProvider(this).get(OrderViewModel.class);
        viewModel.getOrderDetail().observe(this, this::bindOrder);
        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager().findFragmentById(R.id.map);
        if (mapFragment != null) {
            mapFragment.getMapAsync(this);
        }

        loadRestaurantLocation();

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

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        map = googleMap;
        map.getUiSettings().setZoomControlsEnabled(true);
        drawRestaurantMarker();
    }

    private void loadRestaurantLocation() {
        restaurantRepository.getLocation().enqueue(new Callback<RestaurantLocationResponse>() {
            @Override
            public void onResponse(@NonNull Call<RestaurantLocationResponse> call,
                                    @NonNull Response<RestaurantLocationResponse> response) {
                RestaurantLocationResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    restaurantLatLng = new LatLng(body.getLat(), body.getLng());
                    drawRestaurantMarker();
                }
                // Loi/chua cau hinh: khong hien marker nha hang, khong chan man hinh
            }

            @Override
            public void onFailure(@NonNull Call<RestaurantLocationResponse> call, @NonNull Throwable t) {
                // Bo qua - marker nha hang chi la thong tin phu
            }
        });
    }

    private void drawRestaurantMarker() {
        if (map == null || restaurantLatLng == null || restaurantMarker != null) return;
        restaurantMarker = map.addMarker(new MarkerOptions()
                .position(restaurantLatLng)
                .title("FoodGo")
                .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_ORANGE)));
        fitCameraToMarkers();
        updateDistance();
    }

    private void bindOrder(Order order) {
        if (order == null || map == null) return;

        if (order.hasShipCoordinates()) {
            LatLng destination = new LatLng(order.getShipLat(), order.getShipLng());
            if (destinationMarker == null) {
                destinationMarker = map.addMarker(new MarkerOptions()
                        .position(destination)
                        .title("Địa chỉ giao hàng")
                        .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_RED)));
            } else {
                destinationMarker.setPosition(destination);
            }
            fitCameraToMarkers();
            updateDistance();
        }

        DriverLocation driverLocation = order.getDriverLocation();
        if (driverLocation != null) {
            LatLng driverLatLng = new LatLng(driverLocation.getLat(), driverLocation.getLng());
            if (driverMarker == null) {
                driverMarker = map.addMarker(new MarkerOptions()
                        .position(driverLatLng)
                        .title("Tài xế")
                        .icon(BitmapDescriptorFactory.defaultMarker(BitmapDescriptorFactory.HUE_GREEN)));
                fitCameraToMarkers();
            } else {
                // Chi doi vi tri, KHONG lam lai camera - tranh giat man hinh moi lan poll
                driverMarker.setPosition(driverLatLng);
            }
        } else if (driverMarker != null) {
            // Don khong con 'shipped' (da giao/huy) - tu dong go marker tai xe,
            // dung yeu cau bao mat "tu dong ket thuc chia se vi tri" cua spec
            driverMarker.remove();
            driverMarker = null;
        }
    }

    private void updateDistance() {
        if (restaurantLatLng == null || destinationMarker == null) {
            textDistance.setVisibility(View.GONE);
            return;
        }
        double km = DistanceUtils.haversineKm(
                restaurantLatLng.latitude, restaurantLatLng.longitude,
                destinationMarker.getPosition().latitude, destinationMarker.getPosition().longitude);
        textDistance.setText("Khoảng cách: " + DistanceUtils.formatKm(km));
        textDistance.setVisibility(View.VISIBLE);
    }

    // Zoom vua du de thay tat ca marker hien co - chi goi khi THEM marker moi
    // (khong goi moi lan poll vi tri tai xe, tranh giat ban do lien tuc)
    private void fitCameraToMarkers() {
        LatLngBounds.Builder builder = new LatLngBounds.Builder();
        int count = 0;
        if (restaurantMarker != null) { builder.include(restaurantMarker.getPosition()); count++; }
        if (destinationMarker != null) { builder.include(destinationMarker.getPosition()); count++; }
        if (driverMarker != null) { builder.include(driverMarker.getPosition()); count++; }
        if (count == 0) return;
        if (count == 1) {
            LatLng only = restaurantMarker != null ? restaurantMarker.getPosition()
                    : destinationMarker != null ? destinationMarker.getPosition() : driverMarker.getPosition();
            map.moveCamera(CameraUpdateFactory.newLatLngZoom(only, 15f));
            return;
        }
        map.moveCamera(CameraUpdateFactory.newLatLngBounds(builder.build(), 100));
    }
}
