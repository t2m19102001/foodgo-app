package com.foodgo_app.model;

// Smart ETA rule-based (xem backend/util/eta.js): khong co GPS/khoang cach
// thuc nen "deliveryMinutes" la mot khoang trung binh, gop ca thoi gian cho
// tai xe toi lay. delayed/delayMinutes duoc backend tinh lai moi lan doc don
// con 'pending', so voi uoc tinh luc dat hang.
public class EtaInfo {
    private int confirmMinutes;
    private int prepMinutes;
    private int deliveryMinutes;
    private int totalMinutes;
    private String estimatedReadyAt;
    private String estimatedDeliveredAt;
    private String actualConfirmedAt;
    private String actualShippedAt;
    private String actualDeliveredAt;
    private boolean delayed;
    private int delayMinutes;

    public int getConfirmMinutes() { return confirmMinutes; }
    public int getPrepMinutes() { return prepMinutes; }
    public int getDeliveryMinutes() { return deliveryMinutes; }
    public int getTotalMinutes() { return totalMinutes; }
    public String getEstimatedReadyAt() { return estimatedReadyAt; }
    public String getEstimatedDeliveredAt() { return estimatedDeliveredAt; }
    public String getActualConfirmedAt() { return actualConfirmedAt; }
    public String getActualShippedAt() { return actualShippedAt; }
    public String getActualDeliveredAt() { return actualDeliveredAt; }
    public boolean isDelayed() { return delayed; }
    public int getDelayMinutes() { return delayMinutes; }
}
