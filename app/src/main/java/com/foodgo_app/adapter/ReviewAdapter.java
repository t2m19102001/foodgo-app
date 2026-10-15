package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.RatingBar;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.foodgo_app.R;
import com.foodgo_app.util.DateUtils;
import com.foodgo_app.model.Review;
import com.foodgo_app.util.ImageUrlHelper;

import java.util.ArrayList;
import java.util.List;

public class ReviewAdapter extends RecyclerView.Adapter<ReviewAdapter.ReviewViewHolder> {

    private List<Review> reviews = new ArrayList<>();

    public void setReviews(List<Review> newReviews) {
        this.reviews = newReviews != null ? newReviews : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ReviewViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_review, parent, false);
        return new ReviewViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ReviewViewHolder holder, int position) {
        holder.bind(reviews.get(position));
    }

    @Override
    public int getItemCount() {
        return reviews.size();
    }

    static class ReviewViewHolder extends RecyclerView.ViewHolder {
        private final ImageView avatar;
        private final TextView userName;
        private final RatingBar ratingBar;
        private final TextView comment;
        private final TextView date;

        ReviewViewHolder(@NonNull View itemView) {
            super(itemView);
            avatar = itemView.findViewById(R.id.image_avatar);
            userName = itemView.findViewById(R.id.text_user_name);
            ratingBar = itemView.findViewById(R.id.rating_bar);
            comment = itemView.findViewById(R.id.text_comment);
            date = itemView.findViewById(R.id.text_date);
        }

        void bind(Review review) {
            String name = "Người dùng";
            String image = null;
            if (review.getUserId() != null) {
                if (review.getUserId().getName() != null) {
                    name = review.getUserId().getName();
                }
                image = review.getUserId().getImage();
            }
            userName.setText(name);
            ratingBar.setRating(review.getRating());
            comment.setText(review.getComment());
            date.setText(DateUtils.format(review.getCreatedAt()));
            Glide.with(itemView.getContext())
                    .load(ImageUrlHelper.getImageUrl(image))
                    .placeholder(R.drawable.placeholder_avatar)
                    .error(R.drawable.placeholder_avatar)
                    .circleCrop()
                    .into(avatar);
        }
    }
}
