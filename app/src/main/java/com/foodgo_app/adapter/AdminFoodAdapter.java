package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.foodgo_app.R;
import com.foodgo_app.model.Food;
import com.foodgo_app.util.CurrencyUtils;
import com.foodgo_app.util.ImageUrlHelper;

import java.util.ArrayList;
import java.util.List;

public class AdminFoodAdapter extends RecyclerView.Adapter<AdminFoodAdapter.ViewHolder> {

    public interface OnFoodActionListener {
        void onToggleAvailability(Food food);
        void onEdit(Food food);
        void onDelete(Food food);
    }

    private List<Food> foods = new ArrayList<>();
    private final OnFoodActionListener listener;

    public AdminFoodAdapter(OnFoodActionListener listener) {
        this.listener = listener;
    }

    public void setFoods(List<Food> newFoods) {
        this.foods = newFoods != null ? newFoods : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_admin_food, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        holder.bind(foods.get(position), listener);
    }

    @Override
    public int getItemCount() {
        return foods.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        private final ImageView image;
        private final TextView name;
        private final TextView price;
        private final TextView category;
        private final MaterialSwitch switchAvailable;
        private final View btnEdit;
        private final View btnDelete;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            image = itemView.findViewById(R.id.image_food);
            name = itemView.findViewById(R.id.text_food_name);
            price = itemView.findViewById(R.id.text_food_price);
            category = itemView.findViewById(R.id.text_food_category);
            switchAvailable = itemView.findViewById(R.id.switch_available);
            btnEdit = itemView.findViewById(R.id.btn_edit);
            btnDelete = itemView.findViewById(R.id.btn_delete);
        }

        void bind(Food food, OnFoodActionListener listener) {
            name.setText(food.getName());
            price.setText(CurrencyUtils.formatVnd(food.getPrice()));
            category.setText(food.getCategory());
            Glide.with(itemView.getContext())
                    .load(ImageUrlHelper.getImageUrl(food.getImage()))
                    .placeholder(R.drawable.placeholder_food)
                    .error(R.drawable.placeholder_food)
                    .centerCrop()
                    .into(image);

            // Tranh trigger listener khi set lai trang thai luc bind
            switchAvailable.setOnCheckedChangeListener(null);
            switchAvailable.setChecked(food.isAvailable());
            switchAvailable.setOnCheckedChangeListener((buttonView, isChecked) -> {
                if (listener != null && isChecked != food.isAvailable()) {
                    listener.onToggleAvailability(food);
                }
            });

            btnEdit.setOnClickListener(v -> {
                if (listener != null) listener.onEdit(food);
            });
            btnDelete.setOnClickListener(v -> {
                if (listener != null) listener.onDelete(food);
            });
        }
    }
}
