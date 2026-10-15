package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.util.DateUtils;
import com.foodgo_app.model.Order;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.OrderStatusHelper;

import java.util.ArrayList;
import java.util.List;

public class OrderAdapter extends RecyclerView.Adapter<OrderAdapter.OrderViewHolder> {

    public interface OnOrderClickListener {
        void onOrderClick(Order order);
    }

    private List<Order> orders = new ArrayList<>();
    private final OnOrderClickListener listener;

    public OrderAdapter(OnOrderClickListener listener) {
        this.listener = listener;
    }

    public void setOrders(List<Order> newOrders) {
        this.orders = newOrders != null ? newOrders : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public OrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order, parent, false);
        return new OrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull OrderViewHolder holder, int position) {
        holder.bind(orders.get(position), listener);
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class OrderViewHolder extends RecyclerView.ViewHolder {
        private final TextView textOrderCode;
        private final TextView textStatus;
        private final TextView textDate;
        private final TextView textAmount;

        OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            textOrderCode = itemView.findViewById(R.id.text_order_code);
            textStatus = itemView.findViewById(R.id.text_status);
            textDate = itemView.findViewById(R.id.text_date);
            textAmount = itemView.findViewById(R.id.text_amount);
        }

        void bind(Order order, OnOrderClickListener listener) {
            String id = order.getId() != null ? order.getId() : "";
            String shortId = id.length() > 8 ? id.substring(id.length() - 8) : id;
            textOrderCode.setText("Đơn hàng #" + shortId);
            OrderStatusHelper.applyChip(textStatus, order.getStatus());
            textDate.setText(DateUtils.format(order.getDate()));
            textAmount.setText(CurrencyUtils.formatVnd(order.getAmount()));

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onOrderClick(order);
                }
            });
        }
    }
}
