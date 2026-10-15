package com.foodgo_app.model;

public class Address {
    private String fullName;
    private String phone;
    private String address;
    private String note;

    public Address() {
    }

    public Address(String fullName, String phone, String address, String note) {
        this.fullName = fullName;
        this.phone = phone;
        this.address = address;
        this.note = note;
    }

    public String getFullName() { return fullName; }
    public String getPhone() { return phone; }
    public String getAddress() { return address; }
    public String getNote() { return note; }
}
