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
import com.foodgo_app.model.RecommendedFood;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.ImageUrlHelper;

import java.util.ArrayList;
import java.util.List;

public class RecommendationAdapter extends RecyclerView.Adapter<RecommendationAdapter.ViewHolder> {

    public interface OnItemClickListener {
        void onItemClick(RecommendedFood item);
    }

    private List<RecommendedFood> items = new ArrayList<>();
    private final OnItemClickListener listener;

    public RecommendationAdapter(OnItemClickListener listener) {
        this.listener = listener;
    }

    public void setItems(List<RecommendedFood> newItems) {
        this.items = newItems != null ? newItems : new ArrayList<>();
        notifyDataSetChanged();
    }

    public boolean isEmpty() {
        return items.isEmpty();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_recommendation_food, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        holder.bind(items.get(position), listener);
    }

    @Override
    public int getItemCount() {
        return items.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        private final ImageView image;
        private final TextView name;
        private final TextView price;
        private final TextView reason;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            image = itemView.findViewById(R.id.image_food);
            name = itemView.findViewById(R.id.text_food_name);
            price = itemView.findViewById(R.id.text_food_price);
            reason = itemView.findViewById(R.id.text_reason);
        }

        void bind(RecommendedFood item, OnItemClickListener listener) {
            name.setText(item.getFood().getName());
            price.setText(CurrencyUtils.formatVnd(item.getFood().getPrice()));
            reason.setText(item.getReason());
            Glide.with(itemView.getContext())
                    .load(ImageUrlHelper.getImageUrl(item.getFood().getImage()))
                    .placeholder(R.drawable.placeholder_food)
                    .error(R.drawable.placeholder_food)
                    .centerCrop()
                    .into(image);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onItemClick(item);
                }
            });
        }
    }
}
