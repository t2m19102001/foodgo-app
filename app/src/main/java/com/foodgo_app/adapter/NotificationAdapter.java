package com.foodgo_app.adapter;

import android.graphics.Typeface;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.util.DateUtils;
import com.foodgo_app.model.Notification;

import java.util.ArrayList;
import java.util.List;

public class NotificationAdapter extends RecyclerView.Adapter<NotificationAdapter.NotificationViewHolder> {

    public interface OnNotificationClickListener {
        void onNotificationClick(Notification notification);
    }

    private List<Notification> notifications = new ArrayList<>();
    private final OnNotificationClickListener listener;

    public NotificationAdapter(OnNotificationClickListener listener) {
        this.listener = listener;
    }

    public void setNotifications(List<Notification> newNotifications) {
        this.notifications = newNotifications != null ? newNotifications : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public NotificationViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_notification, parent, false);
        return new NotificationViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull NotificationViewHolder holder, int position) {
        holder.bind(notifications.get(position), listener);
    }

    @Override
    public int getItemCount() {
        return notifications.size();
    }

    static class NotificationViewHolder extends RecyclerView.ViewHolder {
        private final View dotUnread;
        private final TextView title;
        private final TextView message;
        private final TextView time;

        NotificationViewHolder(@NonNull View itemView) {
            super(itemView);
            dotUnread = itemView.findViewById(R.id.dot_unread);
            title = itemView.findViewById(R.id.text_title);
            message = itemView.findViewById(R.id.text_message);
            time = itemView.findViewById(R.id.text_time);
        }

        void bind(Notification notification, OnNotificationClickListener listener) {
            title.setText(notification.getTitle());
            message.setText(notification.getMessage());
            time.setText(DateUtils.format(notification.getCreatedAt()));

            boolean unread = !notification.isRead();
            dotUnread.setVisibility(unread ? View.VISIBLE : View.INVISIBLE);
            title.setTypeface(null, unread ? Typeface.BOLD : Typeface.NORMAL);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onNotificationClick(notification);
                }
            });
        }
    }
}
