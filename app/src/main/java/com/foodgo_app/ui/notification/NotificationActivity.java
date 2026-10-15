package com.foodgo_app.ui.notification;

import android.os.Bundle;
import android.view.View;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.adapter.NotificationAdapter;

public class NotificationActivity extends AppCompatActivity {

    private NotificationViewModel viewModel;
    private NotificationAdapter adapter;
    private TextView textEmpty;
    private android.widget.ProgressBar progressBar;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notification);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        RecyclerView recyclerNotifications = findViewById(R.id.recycler_notifications);
        textEmpty = findViewById(R.id.text_empty);
        progressBar = findViewById(R.id.progress_bar);

        viewModel = new ViewModelProvider(this).get(NotificationViewModel.class);

        adapter = new NotificationAdapter(notification -> {
            if (!notification.isRead()) {
                viewModel.markAsRead(notification.getId());
            }
        });
        recyclerNotifications.setLayoutManager(new LinearLayoutManager(this));
        recyclerNotifications.setAdapter(adapter);

        findViewById(R.id.btn_mark_all_read).setOnClickListener(v -> viewModel.markAllAsRead());

        observeViewModel();
        viewModel.loadNotifications();
    }

    private void observeViewModel() {
        viewModel.getNotifications().observe(this, notifications -> {
            adapter.setNotifications(notifications);
            textEmpty.setVisibility(notifications == null || notifications.isEmpty() ? View.VISIBLE : View.GONE);
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
