package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.model.CartItem;
import com.foodgo_app.util.CurrencyUtils;

import java.util.ArrayList;
import java.util.List;

public class CartSummaryAdapter extends RecyclerView.Adapter<CartSummaryAdapter.SummaryViewHolder> {

    private List<CartItem> items = new ArrayList<>();

    public void setItems(List<CartItem> newItems) {
        this.items = newItems != null ? newItems : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public SummaryViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_order_summary, parent, false);
        return new SummaryViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull SummaryViewHolder holder, int position) {
        CartItem item = items.get(position);
        holder.name.setText(item.getFood().getName() + " x" + item.getQuantity());
        holder.price.setText(CurrencyUtils.formatVnd(item.getTotalPrice()));
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class SummaryViewHolder extends RecyclerView.ViewHolder {
        final TextView name;
        final TextView price;

        SummaryViewHolder(@NonNull View itemView) {
            super(itemView);
            name = itemView.findViewById(R.id.text_item_name);
            price = itemView.findViewById(R.id.text_item_price);
        }
    }
}
