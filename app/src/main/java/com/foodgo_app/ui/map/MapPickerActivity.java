package com.foodgo_app.ui.map;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Address;
import android.location.Geocoder;
import android.os.Bundle;
import android.widget.TextView;
import android.widget.Toast;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.ContextCompat;

import com.google.android.gms.location.FusedLocationProviderClient;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.maps.CameraUpdateFactory;
import com.google.android.gms.maps.GoogleMap;
import com.google.android.gms.maps.OnMapReadyCallback;
import com.google.android.gms.maps.SupportMapFragment;
import com.google.android.gms.maps.model.LatLng;
import com.foodgo_app.R;

import java.io.IOException;
import java.util.List;
import java.util.Locale;

// Chon vi tri bang cach DI CHUYEN BAN DO voi 1 pin co dinh o giua man hinh
// (khong keo marker) - don gian hon, tranh phai xu ly OnMarkerDragListener.
// Tra ve {lat, lng, address} qua setResult, KHONG tu luu gi ca - man goi
// (AddEditAddressActivity) chiu trach nhiem gui len server.
public class MapPickerActivity extends AppCompatActivity implements OnMapReadyCallback {

    // TP.HCM - dung khi chua co toa do ban dau va chua lay duoc vi tri GPS
    private static final LatLng DEFAULT_CENTER = new LatLng(10.7769, 106.7009);

    private GoogleMap map;
    private FusedLocationProviderClient fusedLocationClient;
    private TextView textPickedAddress;
    private LatLng pickedLatLng;

    private final ActivityResultLauncher<String> requestPermissionLauncher =
            registerForActivityResult(new ActivityResultContracts.RequestPermission(), granted -> {
                if (granted) {
                    moveToCurrentLocation();
                } else {
                    Toast.makeText(this, "Cần quyền vị trí để xác định vị trí hiện tại", Toast.LENGTH_SHORT).show();
                }
            });

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_map_picker);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        textPickedAddress = findViewById(R.id.text_picked_address);
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this);

        double initialLat = getIntent().getDoubleExtra("lat", Double.NaN);
        double initialLng = getIntent().getDoubleExtra("lng", Double.NaN);
        if (!Double.isNaN(initialLat) && !Double.isNaN(initialLng)) {
            pickedLatLng = new LatLng(initialLat, initialLng);
        }

        SupportMapFragment mapFragment = (SupportMapFragment) getSupportFragmentManager().findFragmentById(R.id.map);
        if (mapFragment != null) {
            mapFragment.getMapAsync(this);
        }

        findViewById(R.id.btn_my_location).setOnClickListener(v -> requestCurrentLocation());
        findViewById(R.id.btn_confirm_location).setOnClickListener(v -> confirmLocation());
    }

    @Override
    public void onMapReady(@NonNull GoogleMap googleMap) {
        map = googleMap;
        map.getUiSettings().setZoomControlsEnabled(true);
        LatLng start = pickedLatLng != null ? pickedLatLng : DEFAULT_CENTER;
        map.moveCamera(CameraUpdateFactory.newLatLngZoom(start, 16f));
        pickedLatLng = start;
        updatePickedAddress(start);

        map.setOnCameraIdleListener(() -> {
            pickedLatLng = map.getCameraPosition().target;
            updatePickedAddress(pickedLatLng);
        });
    }

    private void requestCurrentLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION);
            return;
        }
        moveToCurrentLocation();
    }

    @SuppressWarnings("MissingPermission") // da kiem checkSelfPermission truoc khi goi ham nay
    private void moveToCurrentLocation() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
                != PackageManager.PERMISSION_GRANTED) {
            return;
        }
        fusedLocationClient.getLastLocation().addOnSuccessListener(location -> {
            if (location != null && map != null) {
                LatLng current = new LatLng(location.getLatitude(), location.getLongitude());
                map.animateCamera(CameraUpdateFactory.newLatLngZoom(current, 17f));
            } else {
                Toast.makeText(this, "Không lấy được vị trí hiện tại, vui lòng bật GPS", Toast.LENGTH_SHORT).show();
            }
        });
    }

    // Geocoder co the khong co ket qua (mang yeu, vi tri qua xa khu dan cu) -
    // khong chan nut Xac nhan, chi hien toa do so thay cho dia chi doc duoc.
    @SuppressWarnings("deprecation") // ban Geocoder dong bo van hoat dong binh thuong, chi bi danh dau deprecated tu API 33
    private void updatePickedAddress(LatLng latLng) {
        textPickedAddress.setText(String.format(Locale.US, "%.5f, %.5f", latLng.latitude, latLng.longitude));
        try {
            Geocoder geocoder = new Geocoder(this, Locale.getDefault());
            List<Address> results = geocoder.getFromLocation(latLng.latitude, latLng.longitude, 1);
            if (results != null && !results.isEmpty() && results.get(0).getAddressLine(0) != null) {
                textPickedAddress.setText(results.get(0).getAddressLine(0));
            }
        } catch (IOException | IllegalArgumentException ignored) {
            // Giu toa do so lam fallback, da set o tren
        }
    }

    private void confirmLocation() {
        if (pickedLatLng == null) return;
        Intent result = new Intent();
        result.putExtra("lat", pickedLatLng.latitude);
        result.putExtra("lng", pickedLatLng.longitude);
        result.putExtra("address", textPickedAddress.getText().toString());
        setResult(RESULT_OK, result);
        finish();
    }
}
