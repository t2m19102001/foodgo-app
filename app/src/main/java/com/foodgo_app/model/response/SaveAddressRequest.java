package com.foodgo_app.model.response;

public class SaveAddressRequest {
    private final String fullName;
    private final String phone;
    private final String address;
    private final String note;
    private final boolean isDefault;
    // null = chua chon tren ban do, van hop le
    private final Double lat;
    private final Double lng;

    public SaveAddressRequest(String fullName, String phone, String address, String note, boolean isDefault) {
        this(fullName, phone, address, note, isDefault, null, null);
    }

    public SaveAddressRequest(String fullName, String phone, String address, String note, boolean isDefault,
                               Double lat, Double lng) {
        this.fullName = fullName;
        this.phone = phone;
        this.address = address;
        this.note = note;
        this.isDefault = isDefault;
        this.lat = lat;
        this.lng = lng;
    }
}
