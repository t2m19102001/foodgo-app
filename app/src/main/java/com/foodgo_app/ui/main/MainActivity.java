package com.foodgo_app.ui.main;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentManager;
import androidx.fragment.app.FragmentTransaction;

import com.google.android.material.badge.BadgeDrawable;
import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.foodgo_app.R;
import com.foodgo_app.model.response.NotificationListResponse;
import com.foodgo_app.repository.CartRepository;
import com.foodgo_app.repository.NotificationRepository;
import com.foodgo_app.ui.cart.CartActivity;
import com.foodgo_app.ui.home.HomeFragment;
import com.foodgo_app.ui.notification.NotificationActivity;
import com.foodgo_app.ui.order.OrderHistoryFragment;
import com.foodgo_app.ui.profile.ProfileFragment;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class MainActivity extends AppCompatActivity {

    private static final String TAG_HOME = "tag_home";
    private static final String TAG_ORDERS = "tag_orders";
    private static final String TAG_PROFILE = "tag_profile";
    private static final String KEY_SELECTED_TAB = "selected_tab";

    private Fragment homeFragment;
    private Fragment ordersFragment;
    private Fragment profileFragment;
    private Fragment activeFragment;
    private int selectedTabId = R.id.nav_home;

    private CartRepository cartRepository;
    private NotificationRepository notificationRepository;
    private BottomNavigationView bottomNav;
    private TextView textCartBadge;
    private Toolbar toolbar;
    private View imageToolbarLogo;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        toolbar = findViewById(R.id.toolbar);
        imageToolbarLogo = findViewById(R.id.image_toolbar_logo);
        setSupportActionBar(toolbar);

        cartRepository = new CartRepository(this);
        notificationRepository = new NotificationRepository(this);
        textCartBadge = findViewById(R.id.text_cart_badge);
        findViewById(R.id.btn_cart).setOnClickListener(v ->
                startActivity(new Intent(this, CartActivity.class)));

        bottomNav = findViewById(R.id.bottom_nav);

        FragmentManager fm = getSupportFragmentManager();

        if (savedInstanceState == null) {
            homeFragment = new HomeFragment();
            ordersFragment = new OrderHistoryFragment();
            profileFragment = new ProfileFragment();

            fm.beginTransaction()
                    .add(R.id.fragment_container, homeFragment, TAG_HOME)
                    .add(R.id.fragment_container, ordersFragment, TAG_ORDERS)
                    .hide(ordersFragment)
                    .add(R.id.fragment_container, profileFragment, TAG_PROFILE)
                    .hide(profileFragment)
                    .commit();
            selectedTabId = R.id.nav_home;
        } else {
            homeFragment = fm.findFragmentByTag(TAG_HOME);
            ordersFragment = fm.findFragmentByTag(TAG_ORDERS);
            profileFragment = fm.findFragmentByTag(TAG_PROFILE);
            // Phai lay lai dung tab dang mo, neu khong activeFragment se lech voi fragment
            // dang hien thi va lan chuyen tab sau do se hide sai fragment
            selectedTabId = savedInstanceState.getInt(KEY_SELECTED_TAB, R.id.nav_home);
        }

        activeFragment = fragmentForTab(selectedTabId);
        applyToolbarForTab(selectedTabId);

        bottomNav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_notification) {
                startActivity(new Intent(this, NotificationActivity.class));
                return false;
            }
            Fragment target = fragmentForTab(id);
            if (target == null) {
                return false;
            }
            selectedTabId = id;
            switchFragment(target);
            applyToolbarForTab(id);
            return true;
        });
    }

    @Override
    protected void onSaveInstanceState(@NonNull Bundle outState) {
        super.onSaveInstanceState(outState);
        outState.putInt(KEY_SELECTED_TAB, selectedTabId);
    }

    @Override
    protected void onResume() {
        super.onResume();
        updateCartBadge();
        loadUnreadNotificationCount();
    }

    public void updateCartBadge() {
        int quantity = cartRepository.getTotalQuantity();
        if (quantity <= 0) {
            textCartBadge.setVisibility(View.GONE);
        } else {
            textCartBadge.setVisibility(View.VISIBLE);
            textCartBadge.setText(quantity > 99 ? "99+" : String.valueOf(quantity));
        }
    }

    // Dem so thong bao chua doc de hien badge tren tab Thong bao.
    // Loi mang thi bo qua, day chi la thong tin phu tro
    private void loadUnreadNotificationCount() {
        notificationRepository.getNotifications().enqueue(new Callback<NotificationListResponse>() {
            @Override
            public void onResponse(@NonNull Call<NotificationListResponse> call,
                                   @NonNull Response<NotificationListResponse> response) {
                NotificationListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    applyNotificationBadge(body.getUnreadCount());
                }
            }

            @Override
            public void onFailure(@NonNull Call<NotificationListResponse> call, @NonNull Throwable t) {
                // Khong lam gi
            }
        });
    }

    private void applyNotificationBadge(int count) {
        if (count <= 0) {
            bottomNav.removeBadge(R.id.nav_notification);
            return;
        }
        BadgeDrawable badge = bottomNav.getOrCreateBadge(R.id.nav_notification);
        badge.setMaxCharacterCount(3);
        badge.setNumber(count);
        badge.setBackgroundColor(ContextCompat.getColor(this, R.color.colorPrimary));
        badge.setBadgeTextColor(ContextCompat.getColor(this, R.color.white));
        badge.setVisible(true);
    }

    private Fragment fragmentForTab(int tabId) {
        if (tabId == R.id.nav_orders) {
            return ordersFragment;
        }
        if (tabId == R.id.nav_profile) {
            return profileFragment;
        }
        return homeFragment;
    }

    private void applyToolbarForTab(int tabId) {
        if (tabId == R.id.nav_orders) {
            updateToolbarTitle("Đơn hàng của tôi", false);
        } else if (tabId == R.id.nav_profile) {
            updateToolbarTitle("Tài khoản", false);
        } else {
            updateToolbarTitle(getString(R.string.app_name), true);
        }
    }

    private void updateToolbarTitle(String title, boolean isBrand) {
        // Tab Trang chu hien logo FoodGo thay vi chu, cac tab khac hien tieu de chu binh thuong.
        // Phai doi qua getSupportActionBar() vi da goi setSupportActionBar(toolbar):
        // goi thang toolbar.setTitle() se bi ActionBar dong bo de lai title cu, khong xoa duoc.
        imageToolbarLogo.setVisibility(isBrand ? View.VISIBLE : View.GONE);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setTitle(isBrand ? "" : title);
        }
        toolbar.setTitleTextAppearance(this, isBrand
                ? R.style.TextAppearance_App_ToolbarTitle_Brand
                : R.style.TextAppearance_App_ToolbarTitle);
        // MaterialToolbar ghi de mau chu cua TextAppearance nen phai dat mau rieng
        toolbar.setTitleTextColor(ContextCompat.getColor(this,
                isBrand ? R.color.colorPrimary : R.color.text_primary));
    }

    private void switchFragment(Fragment target) {
        if (target == null || target == activeFragment) {
            return;
        }
        FragmentTransaction transaction = getSupportFragmentManager().beginTransaction();
        if (activeFragment != null) {
            transaction.hide(activeFragment);
        }
        transaction.show(target);
        transaction.commit();
        activeFragment = target;
    }
}
