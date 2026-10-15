package com.foodgo_app.model.response;

public class SaveAddressRequest {
    private final String fullName;
    private final String phone;
    private final String address;
    private final String note;
    private final boolean isDefault;

    public SaveAddressRequest(String fullName, String phone, String address, String note, boolean isDefault) {
        this.fullName = fullName;
        this.phone = phone;
        this.address = address;
        this.note = note;
        this.isDefault = isDefault;
    }
}
