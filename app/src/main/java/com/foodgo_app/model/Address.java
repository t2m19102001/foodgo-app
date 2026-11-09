package com.foodgo_app.model;

public class Address {
    private String fullName;
    private String phone;
    private String address;
    private String note;
    private Double lat;
    private Double lng;

    public Address() {
    }

    public Address(String fullName, String phone, String address, String note) {
        this.fullName = fullName;
        this.phone = phone;
        this.address = address;
        this.note = note;
    }

    public Address(String fullName, String phone, String address, String note, Double lat, Double lng) {
        this.fullName = fullName;
        this.phone = phone;
        this.address = address;
        this.note = note;
        this.lat = lat;
        this.lng = lng;
    }

    public String getFullName() { return fullName; }
    public String getPhone() { return phone; }
    public String getAddress() { return address; }
    public String getNote() { return note; }
    public Double getLat() { return lat; }
    public Double getLng() { return lng; }
}
