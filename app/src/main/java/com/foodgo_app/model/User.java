package com.foodgo_app.model;

import com.google.gson.annotations.SerializedName;

public class User {
    @SerializedName("_id")
    private String id;
    private String name;
    private String email;
    private String phone;
    private String address;
    private String image;
    private boolean isAdmin;
    private boolean isActive;

    public String getId() { return id; }
    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
    public String getAddress() { return address; }
    public String getImage() { return image; }
    public boolean isAdmin() { return isAdmin; }
    public boolean isActive() { return isActive; }
}
