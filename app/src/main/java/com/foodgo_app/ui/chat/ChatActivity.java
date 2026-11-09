package com.foodgo_app.ui.chat;

import android.os.Bundle;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageButton;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.lifecycle.ViewModelProvider;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.adapter.ChatMessageAdapter;

public class ChatActivity extends AppCompatActivity {

    private ChatViewModel viewModel;
    private ChatMessageAdapter adapter;
    private RecyclerView recyclerMessages;
    private View typingIndicator;
    private EditText editMessage;
    private ImageButton btnSend;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat);

        Toolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());

        recyclerMessages = findViewById(R.id.recycler_messages);
        typingIndicator = findViewById(R.id.layout_typing_indicator);
        editMessage = findViewById(R.id.edit_message);
        btnSend = findViewById(R.id.btn_send);

        adapter = new ChatMessageAdapter();
        recyclerMessages.setLayoutManager(new LinearLayoutManager(this));
        recyclerMessages.setAdapter(adapter);

        btnSend.setOnClickListener(v -> trySend());
        editMessage.setOnEditorActionListener((v, actionId, event) -> {
            trySend();
            return true;
        });

        viewModel = new ViewModelProvider(this).get(ChatViewModel.class);
        viewModel.getMessages().observe(this, messages -> {
            adapter.setMessages(messages);
            if (messages != null && !messages.isEmpty()) {
                recyclerMessages.scrollToPosition(messages.size() - 1);
            }
        });
        viewModel.getSending().observe(this, sending -> {
            boolean isSending = Boolean.TRUE.equals(sending);
            typingIndicator.setVisibility(isSending ? View.VISIBLE : View.GONE);
            btnSend.setEnabled(!isSending);
        });
        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });
    }

    private void trySend() {
        String text = editMessage.getText().toString().trim();
        if (text.isEmpty()) {
            return;
        }
        viewModel.sendMessage(text);
        editMessage.setText("");
    }
}
