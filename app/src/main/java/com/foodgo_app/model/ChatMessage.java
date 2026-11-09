package com.foodgo_app.model;

public class ChatMessage {
    private String role; // "user" | "assistant"
    private String content;
    private String createdAt;

    // Dung de hien ngay tin nhan GUI DI (optimistic UI) truoc khi server
    // tra loi - role luon la "user" trong truong hop nay.
    public ChatMessage(String role, String content) {
        this.role = role;
        this.content = content;
    }

    public String getRole() { return role; }
    public String getContent() { return content; }
    public String getCreatedAt() { return createdAt; }
    public boolean isFromUser() { return "user".equals(role); }
}
