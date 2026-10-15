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
import com.foodgo_app.model.Food;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.ImageUrlHelper;

import java.util.ArrayList;
import java.util.List;

public class FoodAdapter extends RecyclerView.Adapter<FoodAdapter.FoodViewHolder> {

    public interface OnFoodClickListener {
        void onFoodClick(Food food);
    }

    public interface OnQuickAddListener {
        void onQuickAdd(Food food);
    }

    private List<Food> foods = new ArrayList<>();
    private final OnFoodClickListener listener;
    private final OnQuickAddListener quickAddListener;

    public FoodAdapter(OnFoodClickListener listener, OnQuickAddListener quickAddListener) {
        this.listener = listener;
        this.quickAddListener = quickAddListener;
    }

    public void setFoods(List<Food> newFoods) {
        this.foods = newFoods != null ? newFoods : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public FoodViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_food, parent, false);
        return new FoodViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull FoodViewHolder holder, int position) {
        Food food = foods.get(position);
        holder.bind(food, listener, quickAddListener);
    }

    @Override
    public int getItemCount() {
        return foods.size();
    }

    static class FoodViewHolder extends RecyclerView.ViewHolder {
        private final ImageView image;
        private final TextView name;
        private final TextView price;
        private final TextView soldOut;
        private final View btnQuickAdd;

        FoodViewHolder(@NonNull View itemView) {
            super(itemView);
            image = itemView.findViewById(R.id.image_food);
            name = itemView.findViewById(R.id.text_food_name);
            price = itemView.findViewById(R.id.text_food_price);
            soldOut = itemView.findViewById(R.id.text_sold_out);
            btnQuickAdd = itemView.findViewById(R.id.btn_quick_add);
        }

        void bind(Food food, OnFoodClickListener listener, OnQuickAddListener quickAddListener) {
            name.setText(food.getName());
            price.setText(CurrencyUtils.formatVnd(food.getPrice()));
            Glide.with(itemView.getContext())
                    .load(ImageUrlHelper.getImageUrl(food.getImage()))
                    .placeholder(R.drawable.placeholder_food)
                    .error(R.drawable.placeholder_food)
                    .centerCrop()
                    .into(image);

            // Mon het hang: anh mo di, hien nhan va an nut them nhanh vao gio
            boolean available = food.isAvailable();
            soldOut.setVisibility(available ? View.GONE : View.VISIBLE);
            image.setAlpha(available ? 1f : 0.45f);
            btnQuickAdd.setVisibility(available ? View.VISIBLE : View.GONE);

            itemView.setOnClickListener(v -> {
                if (listener != null) {
                    listener.onFoodClick(food);
                }
            });
            btnQuickAdd.setOnClickListener(v -> {
                if (quickAddListener != null) {
                    quickAddListener.onQuickAdd(food);
                }
            });
        }
    }
}
