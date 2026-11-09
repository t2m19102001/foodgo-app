package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.model.ChatMessage;

import java.util.ArrayList;
import java.util.List;

// Adapter 2 view-type dau tien trong project (bong bong chat cua khach vs
// cua AI) - cac adapter khac trong app/adapter/ deu chi 1 view-type.
public class ChatMessageAdapter extends RecyclerView.Adapter<ChatMessageAdapter.MessageViewHolder> {

    private static final int VIEW_TYPE_USER = 0;
    private static final int VIEW_TYPE_BOT = 1;

    private List<ChatMessage> messages = new ArrayList<>();

    public void setMessages(List<ChatMessage> newMessages) {
        this.messages = newMessages != null ? newMessages : new ArrayList<>();
        notifyDataSetChanged();
    }

    @Override
    public int getItemViewType(int position) {
        return messages.get(position).isFromUser() ? VIEW_TYPE_USER : VIEW_TYPE_BOT;
    }

    @NonNull
    @Override
    public MessageViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        int layoutRes = viewType == VIEW_TYPE_USER ? R.layout.item_chat_message_user : R.layout.item_chat_message_bot;
        View view = LayoutInflater.from(parent.getContext()).inflate(layoutRes, parent, false);
        return new MessageViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull MessageViewHolder holder, int position) {
        holder.bind(messages.get(position));
    }

    @Override
    public int getItemCount() {
        return messages.size();
    }

    static class MessageViewHolder extends RecyclerView.ViewHolder {
        private final TextView content;

        MessageViewHolder(@NonNull View itemView) {
            super(itemView);
            content = itemView.findViewById(R.id.text_message_content);
        }

        void bind(ChatMessage message) {
            content.setText(message.getContent());
        }
    }
}
