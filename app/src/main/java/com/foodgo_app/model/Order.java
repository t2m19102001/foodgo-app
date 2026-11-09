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
    // Tien VNPay ve sau khi don da het han/huy, hoac khach tra hai lan: can hoan tien
    private boolean refundRequired;
    // Chi co gia tri khi goi API admin, cac API cua user tra ve null
    private Customer customer;
    // null voi don dat truoc khi co Smart ETA (xem backend/migrations/006_smart_eta.sql)
    private EtaInfo eta;
    // Toa do giao hang snapshot luc dat don (module Maps) - null voi don dat
    // truoc migration 010 hoac dia chi khong chon tren ban do
    private Double shipLat;
    private Double shipLng;
    // Chi co gia tri khi trang thai la 'shipped' va da gan tai xe (module
    // Location Sharing) - xem backend/db/mappers.js
    private DriverLocation driverLocation;

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
    public boolean isRefundRequired() { return refundRequired; }
    public Customer getCustomer() { return customer; }
    public EtaInfo getEta() { return eta; }
    public Double getShipLat() { return shipLat; }
    public Double getShipLng() { return shipLng; }
    public boolean hasShipCoordinates() { return shipLat != null && shipLng != null; }
    public DriverLocation getDriverLocation() { return driverLocation; }
}
