package com.foodgo_app.model.response;

import com.foodgo_app.model.Notification;

import java.util.List;

public class NotificationListResponse {
    private boolean success;
    private String message;
    private List<Notification> notifications;
    // So thong bao chua doc, dung cho badge tren bottom navigation
    private int unreadCount;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<Notification> getNotifications() { return notifications; }
    public int getUnreadCount() { return unreadCount; }
}
