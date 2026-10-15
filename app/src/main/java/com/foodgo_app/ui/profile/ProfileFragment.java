package com.foodgo_app.ui.profile;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;
import androidx.lifecycle.ViewModelProvider;

import com.bumptech.glide.Glide;
import com.foodgo_app.R;
import com.foodgo_app.model.User;
import com.foodgo_app.ui.address.AddressListActivity;
import com.foodgo_app.ui.admin.AdminCategoryActivity;
import com.foodgo_app.ui.admin.AdminFoodActivity;
import com.foodgo_app.ui.admin.AdminOrderActivity;
import com.foodgo_app.ui.admin.AdminStatsActivity;
import com.foodgo_app.ui.auth.LoginActivity;
import com.foodgo_app.util.ImageUrlHelper;
import com.foodgo_app.util.SessionManager;

public class ProfileFragment extends Fragment {

    private ProfileViewModel viewModel;

    private ImageView imageAvatar;
    private TextView textName;
    private TextView textEmail;
    private TextView textPhone;
    private TextView textAddress;
    private ProgressBar progressBar;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                              @Nullable Bundle savedInstanceState) {
        return inflater.inflate(R.layout.fragment_profile, container, false);
    }

    @Override
    public void onViewCreated(@NonNull View view, @Nullable Bundle savedInstanceState) {
        super.onViewCreated(view, savedInstanceState);

        viewModel = new ViewModelProvider(this).get(ProfileViewModel.class);

        imageAvatar = view.findViewById(R.id.image_avatar);
        textName = view.findViewById(R.id.text_name);
        textEmail = view.findViewById(R.id.text_email);
        textPhone = view.findViewById(R.id.text_phone);
        textAddress = view.findViewById(R.id.text_address);
        progressBar = view.findViewById(R.id.progress_bar);

        view.findViewById(R.id.btn_edit_profile).setOnClickListener(v ->
                startActivity(new Intent(getActivity(), EditProfileActivity.class)));

        view.findViewById(R.id.btn_my_addresses).setOnClickListener(v ->
                startActivity(new Intent(getActivity(), AddressListActivity.class)));

        view.findViewById(R.id.btn_change_password).setOnClickListener(v ->
                startActivity(new Intent(getActivity(), ChangePasswordActivity.class)));

        // Khu vuc quan tri chi mo cho tai khoan admin
        if (new SessionManager(requireContext()).isAdmin()) {
            view.findViewById(R.id.layout_admin).setVisibility(View.VISIBLE);
            view.findViewById(R.id.btn_admin_orders).setOnClickListener(v ->
                    startActivity(new Intent(getActivity(), AdminOrderActivity.class)));
            view.findViewById(R.id.btn_admin_foods).setOnClickListener(v ->
                    startActivity(new Intent(getActivity(), AdminFoodActivity.class)));
            view.findViewById(R.id.btn_admin_categories).setOnClickListener(v ->
                    startActivity(new Intent(getActivity(), AdminCategoryActivity.class)));
            view.findViewById(R.id.btn_admin_stats).setOnClickListener(v ->
                    startActivity(new Intent(getActivity(), AdminStatsActivity.class)));
        }

        view.findViewById(R.id.btn_logout).setOnClickListener(v -> {
            viewModel.logout();
            Intent intent = new Intent(getActivity(), LoginActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            startActivity(intent);
            if (getActivity() != null) {
                getActivity().finish();
            }
        });

        observeViewModel();
        viewModel.loadProfile();
    }

    @Override
    public void onResume() {
        super.onResume();
        viewModel.loadProfile();
    }

    private void observeViewModel() {
        viewModel.getUser().observe(getViewLifecycleOwner(), this::bindUser);

        viewModel.getLoading().observe(getViewLifecycleOwner(), isLoading ->
                progressBar.setVisibility(Boolean.TRUE.equals(isLoading) ? View.VISIBLE : View.GONE));

        viewModel.getError().observe(getViewLifecycleOwner(), message -> {
            if (message != null && !message.isEmpty() && getContext() != null) {
                Toast.makeText(getContext(), message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });
    }

    private void bindUser(User user) {
        if (user == null || getContext() == null) {
            return;
        }
        textName.setText(user.getName());
        textEmail.setText(user.getEmail());
        bindInfoRow(textPhone, user.getPhone(), "Chưa cập nhật số điện thoại");
        bindInfoRow(textAddress, user.getAddress(), "Chưa cập nhật địa chỉ");
        Glide.with(getContext())
                .load(ImageUrlHelper.getImageUrl(user.getImage()))
                .placeholder(R.drawable.placeholder_avatar)
                .error(R.drawable.placeholder_avatar)
                .circleCrop()
                .into(imageAvatar);
    }

    private void bindInfoRow(TextView view, String value, String emptyText) {
        boolean isEmpty = value == null || value.trim().isEmpty();
        view.setText(isEmpty ? emptyText : value);
        view.setTextColor(ContextCompat.getColor(requireContext(),
                isEmpty ? R.color.text_hint : R.color.text_primary));
    }
}
