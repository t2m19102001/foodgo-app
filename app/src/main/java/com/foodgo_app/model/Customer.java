package com.foodgo_app.model;

// Thong tin khach hang kem theo don hang, chi co trong API danh cho admin (GET /api/order/list)
public class Customer {
    private String name;
    private String email;
    private String phone;

    public String getName() { return name; }
    public String getEmail() { return email; }
    public String getPhone() { return phone; }
}
