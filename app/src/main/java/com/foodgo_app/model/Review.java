package com.foodgo_app.model;

import com.google.gson.annotations.SerializedName;

public class Review {
    @SerializedName("_id")
    private String id;
    private UserRef userId;
    private String foodId;
    private int rating;
    private String comment;
    private String createdAt;

    public String getId() { return id; }
    public UserRef getUserId() { return userId; }
    public String getFoodId() { return foodId; }
    public int getRating() { return rating; }
    public String getComment() { return comment; }
    public String getCreatedAt() { return createdAt; }

    public static class UserRef {
        @SerializedName("_id")
        private String id;
        private String name;
        private String image;

        public String getId() { return id; }
        public String getName() { return name; }
        public String getImage() { return image; }
    }
}
