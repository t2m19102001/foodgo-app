package com.foodgo_app.model.response;

import com.foodgo_app.model.ChatMessage;

import java.util.List;

public class ChatHistoryResponse {
    private boolean success;
    private String message;
    private List<ChatMessage> messages;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<ChatMessage> getMessages() { return messages; }
}
