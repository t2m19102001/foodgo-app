package com.foodgo_app.ui.chat;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.ChatMessage;
import com.foodgo_app.model.response.ChatHistoryResponse;
import com.foodgo_app.model.response.ChatSendResponse;
import com.foodgo_app.repository.ChatRepository;
import com.foodgo_app.util.ApiErrorUtils;

import java.util.ArrayList;
import java.util.List;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class ChatViewModel extends AndroidViewModel {

    private final ChatRepository chatRepository;

    private final MutableLiveData<List<ChatMessage>> messages = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<Boolean> sending = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();

    public ChatViewModel(@NonNull Application application) {
        super(application);
        chatRepository = new ChatRepository(application);
        loadHistory();
    }

    public LiveData<List<ChatMessage>> getMessages() { return messages; }
    public LiveData<Boolean> getSending() { return sending; }
    public LiveData<String> getError() { return error; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }

    public void loadHistory() {
        chatRepository.getHistory().enqueue(new Callback<ChatHistoryResponse>() {
            @Override
            public void onResponse(@NonNull Call<ChatHistoryResponse> call, @NonNull Response<ChatHistoryResponse> response) {
                ChatHistoryResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    messages.setValue(body.getMessages() != null ? body.getMessages() : new ArrayList<>());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải lịch sử hội thoại"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ChatHistoryResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void sendMessage(String text) {
        List<ChatMessage> current = new ArrayList<>(
                messages.getValue() != null ? messages.getValue() : new ArrayList<>());
        // Hien ngay tin nhan cua khach (optimistic UI) - khong doi server xac nhan
        current.add(new ChatMessage("user", text));
        messages.setValue(current);

        sending.setValue(true);
        chatRepository.sendMessage(text).enqueue(new Callback<ChatSendResponse>() {
            @Override
            public void onResponse(@NonNull Call<ChatSendResponse> call, @NonNull Response<ChatSendResponse> response) {
                sending.setValue(false);
                ChatSendResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    List<ChatMessage> updated = new ArrayList<>(
                            messages.getValue() != null ? messages.getValue() : new ArrayList<>());
                    updated.add(new ChatMessage("assistant", body.getReply()));
                    messages.setValue(updated);
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể gửi tin nhắn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<ChatSendResponse> call, @NonNull Throwable t) {
                sending.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }
}
