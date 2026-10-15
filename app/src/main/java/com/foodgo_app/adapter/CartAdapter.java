package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.foodgo_app.R;
import com.foodgo_app.model.CartItem;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.ImageUrlHelper;

import java.util.ArrayList;
import java.util.List;

public class CartAdapter extends RecyclerView.Adapter<CartAdapter.CartViewHolder> {

    public interface OnCartActionListener {
        void onIncrease(CartItem item);
        void onDecrease(CartItem item);
        void onRemove(CartItem item);
    }

    private List<CartItem> items = new ArrayList<>();
    private final OnCartActionListener listener;

    public CartAdapter(OnCartActionListener listener) {
        this.listener = listener;
    }

    public void setItems(List<CartItem> newItems) {
        this.items = newItems != null ? newItems : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public CartViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_cart, parent, false);
        return new CartViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull CartViewHolder holder, int position) {
        holder.bind(items.get(position), listener);
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class CartViewHolder extends RecyclerView.ViewHolder {
        private final ImageView image;
        private final TextView name;
        private final TextView price;
        private final TextView quantity;
        private final View btnIncrease;
        private final View btnDecrease;
        private final View btnRemove;

        CartViewHolder(@NonNull View itemView) {
            super(itemView);
            image = itemView.findViewById(R.id.image_food);
            name = itemView.findViewById(R.id.text_food_name);
            price = itemView.findViewById(R.id.text_food_price);
            quantity = itemView.findViewById(R.id.text_quantity);
            btnIncrease = itemView.findViewById(R.id.btn_increase);
            btnDecrease = itemView.findViewById(R.id.btn_decrease);
            btnRemove = itemView.findViewById(R.id.btn_remove);
        }

        void bind(CartItem item, OnCartActionListener listener) {
            name.setText(item.getFood().getName());
            price.setText(CurrencyUtils.formatVnd(item.getTotalPrice()));
            quantity.setText(String.valueOf(item.getQuantity()));
            Glide.with(itemView.getContext())
                    .load(ImageUrlHelper.getImageUrl(item.getFood().getImage()))
                    .placeholder(R.drawable.placeholder_food)
                    .error(R.drawable.placeholder_food)
                    .centerCrop()
                    .into(image);

            btnIncrease.setOnClickListener(v -> {
                if (listener != null) listener.onIncrease(item);
            });
            btnDecrease.setOnClickListener(v -> {
                if (listener != null) listener.onDecrease(item);
            });
            btnRemove.setOnClickListener(v -> {
                if (listener != null) listener.onRemove(item);
            });
        }
    }
}
