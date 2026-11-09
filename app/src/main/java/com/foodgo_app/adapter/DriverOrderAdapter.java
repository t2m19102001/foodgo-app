package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.model.Order;
import com.foodgo_app.util.CurrencyUtils;

import java.util.ArrayList;
import java.util.List;

public class DriverOrderAdapter extends RecyclerView.Adapter<DriverOrderAdapter.OrderViewHolder> {

    public interface OnOrderClickListener {
        void onClick(Order order);
    }

    private List<Order> orders = new ArrayList<>();
    private final OnOrderClickListener listener;

    public DriverOrderAdapter(OnOrderClickListener listener) {
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
                .inflate(R.layout.item_driver_order, parent, false);
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
        private final TextView textAddress;
        private final TextView textAmount;

        OrderViewHolder(@NonNull View itemView) {
            super(itemView);
            textOrderCode = itemView.findViewById(R.id.text_order_code);
            textAddress = itemView.findViewById(R.id.text_address);
            textAmount = itemView.findViewById(R.id.text_amount);
        }

        void bind(Order order, OnOrderClickListener listener) {
            String id = order.getId();
            String shortId = id != null && id.length() > 8 ? id.substring(id.length() - 8) : id;
            textOrderCode.setText("Đơn hàng #" + shortId);
            textAddress.setText(order.getAddress() != null ? order.getAddress().getAddress() : "");
            textAmount.setText(CurrencyUtils.formatVnd(order.getAmount()));
            itemView.setOnClickListener(v -> {
                if (listener != null) listener.onClick(order);
            });
        }
    }
}
