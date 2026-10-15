package com.foodgo_app.model;

import com.google.gson.annotations.SerializedName;

public class Food {
    @SerializedName("_id")
    private String id;
    private String name;
    private String description;
    private double price;
    private String image;
    private String category;
    private boolean isAvailable;

    public String getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public double getPrice() { return price; }
    public String getImage() { return image; }
    public String getCategory() { return category; }
    public boolean isAvailable() { return isAvailable; }
}
