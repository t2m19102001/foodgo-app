package com.foodgo_app.model;

import com.google.gson.annotations.SerializedName;

public class Category {
    @SerializedName("_id")
    private String id;
    private String name;
    private String image;

    public String getId() { return id; }
    public String getName() { return name; }
    public String getImage() { return image; }
}
