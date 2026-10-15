package com.foodgo_app.model;

import com.google.gson.annotations.SerializedName;

import java.util.List;

public class Order {
    @SerializedName("_id")
    private String id;
    private String userId;
    private List<OrderItem> items;
    private double amount;
    private Address address;
    private String paymentMethod;
    private String paymentStatus;
    private String status;
    private String cancelReason;
    private String date;
    private boolean isCancellable;
    // Chi co gia tri khi goi API admin, cac API cua user tra ve null
    private Customer customer;

    public String getId() { return id; }
    public String getUserId() { return userId; }
    public List<OrderItem> getItems() { return items; }
    public double getAmount() { return amount; }
    public Address getAddress() { return address; }
    public String getPaymentMethod() { return paymentMethod; }
    public String getPaymentStatus() { return paymentStatus; }
    public String getStatus() { return status; }
    public String getCancelReason() { return cancelReason; }
    public String getDate() { return date; }
    public boolean isCancellable() { return isCancellable; }
    public Customer getCustomer() { return customer; }
}
