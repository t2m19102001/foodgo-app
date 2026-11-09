package com.foodgo_app.repository;

import android.content.Context;

import com.foodgo_app.api.ApiClient;
import com.foodgo_app.api.ApiService;
import com.foodgo_app.model.response.ChatHistoryResponse;
import com.foodgo_app.model.response.ChatMessageRequest;
import com.foodgo_app.model.response.ChatSendResponse;

import retrofit2.Call;

public class ChatRepository {

    private final ApiService apiService;

    public ChatRepository(Context context) {
        apiService = ApiClient.getApiService(context);
    }

    public Call<ChatSendResponse> sendMessage(String message) {
        return apiService.sendChatMessage(new ChatMessageRequest(message));
    }

    public Call<ChatHistoryResponse> getHistory() {
        return apiService.getChatHistory();
    }
}
