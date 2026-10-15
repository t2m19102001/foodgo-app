package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.foodgo_app.R;
import com.foodgo_app.model.OrderItem;
import com.foodgo_app.util.CurrencyUtils;

import java.util.ArrayList;
import java.util.List;

public class OrderItemAdapter extends RecyclerView.Adapter<OrderItemAdapter.OrderItemViewHolder> {

    public interface OnReviewClickListener {
        void onReviewClick(OrderItem item);
    }

    private List<OrderItem> items = new ArrayList<>();
    private final OnReviewClickListener reviewClickListener;
    private boolean reviewEnabled = false;

    public OrderItemAdapter() {
        this(null);
    }

    public OrderItemAdapter(@Nullable OnReviewClickListener reviewClickListener) {
        this.reviewClickListener = reviewClickListener;
    }

    public void setItems(List<OrderItem> newItems) {
        this.items = newItems != null ? newItems : new ArrayList<>();
        notifyDataSetChanged();
    }

    // Chi don da giao moi cho danh gia (backend cung kiem tra lai dieu kien nay)
    public void setReviewEnabled(boolean enabled) {
        if (this.reviewEnabled == enabled) {
            return;
        }
        this.reviewEnabled = enabled;
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public OrderItemViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order_summary, parent, false);
        return new OrderItemViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderItemViewHolder holder, int position) {
        OrderItem item = items.get(position);
        holder.name.setText(item.getName() + " x" + item.getQuantity());
        holder.price.setText(CurrencyUtils.formatVnd(item.getPrice() * item.getQuantity()));

        boolean showReview = reviewEnabled && reviewClickListener != null;
        holder.btnReview.setVisibility(showReview ? View.VISIBLE : View.GONE);
        holder.btnReview.setOnClickListener(showReview
                ? v -> reviewClickListener.onReviewClick(item)
                : null);
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class OrderItemViewHolder extends RecyclerView.ViewHolder {
        final TextView name;
        final TextView price;
        final MaterialButton btnReview;

        OrderItemViewHolder(@NonNull View itemView) {
            super(itemView);
            name = itemView.findViewById(R.id.text_item_name);
            price = itemView.findViewById(R.id.text_item_price);
            btnReview = itemView.findViewById(R.id.btn_review);
        }
    }
}
