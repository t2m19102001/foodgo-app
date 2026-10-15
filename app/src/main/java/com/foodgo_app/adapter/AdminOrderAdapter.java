package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.foodgo_app.R;
import com.foodgo_app.model.Order;
import com.foodgo_app.model.OrderItem;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.DateUtils;
import com.foodgo_app.util.OrderStatusHelper;

import java.util.ArrayList;
import java.util.List;

public class AdminOrderAdapter extends RecyclerView.Adapter<AdminOrderAdapter.AdminOrderViewHolder> {

    public interface OnUpdateStatusListener {
        void onUpdateStatus(Order order);
    }

    public interface OnOrderClickListener {
        void onOrderClick(Order order);
    }

    private List<Order> orders = new ArrayList<>();
    private final OnUpdateStatusListener updateStatusListener;
    private final OnOrderClickListener orderClickListener;

    public AdminOrderAdapter(OnUpdateStatusListener updateStatusListener,
                            OnOrderClickListener orderClickListener) {
        this.updateStatusListener = updateStatusListener;
        this.orderClickListener = orderClickListener;
    }

    public void setOrders(List<Order> newOrders) {
        this.orders = newOrders != null ? newOrders : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public AdminOrderViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_admin_order, parent, false);
        return new AdminOrderViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull AdminOrderViewHolder holder, int position) {
        holder.bind(orders.get(position), updateStatusListener, orderClickListener);
    }

    @Override
    public int getItemCount() {
        return orders.size();
    }

    static class AdminOrderViewHolder extends RecyclerView.ViewHolder {
        private final TextView textOrderCode;
        private final TextView textStatus;
        private final TextView textCustomer;
        private final TextView textAddress;
        private final TextView textItems;
        private final TextView textDate;
        private final TextView textAmount;
        private final MaterialButton btnUpdateStatus;

        AdminOrderViewHolder(@NonNull View itemView) {
            super(itemView);
            textOrderCode = itemView.findViewById(R.id.text_order_code);
            textStatus = itemView.findViewById(R.id.text_status);
            textCustomer = itemView.findViewById(R.id.text_customer);
            textAddress = itemView.findViewById(R.id.text_address);
            textItems = itemView.findViewById(R.id.text_items);
            textDate = itemView.findViewById(R.id.text_date);
            textAmount = itemView.findViewById(R.id.text_amount);
            btnUpdateStatus = itemView.findViewById(R.id.btn_update_status);
        }

        void bind(Order order, OnUpdateStatusListener updateStatusListener,
                  OnOrderClickListener orderClickListener) {
            String id = order.getId() != null ? order.getId() : "";
            String shortId = id.length() > 8 ? id.substring(id.length() - 8) : id;
            textOrderCode.setText("Đơn hàng #" + shortId);
            OrderStatusHelper.applyChip(textStatus, order.getStatus());
            textDate.setText(DateUtils.format(order.getDate()));
            textAmount.setText(CurrencyUtils.formatVnd(order.getAmount()));

            textCustomer.setText(buildCustomerText(order));
            textAddress.setText(order.getAddress() != null ? order.getAddress().getAddress() : "");
            textItems.setText(buildItemsText(order.getItems()));

            boolean canUpdate = !OrderStatusHelper.getNextStatuses(order.getStatus()).isEmpty();
            btnUpdateStatus.setVisibility(canUpdate ? View.VISIBLE : View.GONE);
            btnUpdateStatus.setOnClickListener(v -> {
                if (updateStatusListener != null) {
                    updateStatusListener.onUpdateStatus(order);
                }
            });

            itemView.setOnClickListener(v -> {
                if (orderClickListener != null) {
                    orderClickListener.onOrderClick(order);
                }
            });
        }

        // Ten khach lay tu field "customer" (chi API admin moi tra ve), fallback sang dia chi giao hang
        private String buildCustomerText(Order order) {
            String name = null;
            String phone = null;
            if (order.getCustomer() != null) {
                name = order.getCustomer().getName();
                phone = order.getCustomer().getPhone();
            }
            if (order.getAddress() != null) {
                if (name == null || name.trim().isEmpty()) {
                    name = order.getAddress().getFullName();
                }
                if (phone == null || phone.trim().isEmpty()) {
                    phone = order.getAddress().getPhone();
                }
            }
            if (name == null || name.trim().isEmpty()) {
                name = "Khách hàng";
            }
            return phone == null || phone.trim().isEmpty() ? name : name + " - " + phone;
        }

        private String buildItemsText(List<OrderItem> items) {
            if (items == null || items.isEmpty()) {
                return "Không có món";
            }
            StringBuilder builder = new StringBuilder();
            for (int i = 0; i < items.size(); i++) {
                if (i > 0) {
                    builder.append(", ");
                }
                builder.append(items.get(i).getName()).append(" x").append(items.get(i).getQuantity());
            }
            return builder.toString();
        }
    }
}
