package com.foodgo_app.model;

import com.google.gson.annotations.SerializedName;

public class SavedAddress {
    @SerializedName("_id")
    private String id;
    private String fullName;
    private String phone;
    private String address;
    private String note;
    private boolean isDefault;

    public String getId() { return id; }
    public String getFullName() { return fullName; }
    public String getPhone() { return phone; }
    public String getAddress() { return address; }
    public String getNote() { return note; }
    public boolean isDefault() { return isDefault; }
}
