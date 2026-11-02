package com.foodgo_app.model.response;

import com.foodgo_app.model.Order;

public class OrderDetailResponse {
    private boolean success;
    private String message;
    private String orderId;
    private Order order;
    // Chi co khi dat hang bang VNPay va don CHUA thanh toan: server khong tra
    // orderId/order trong truong hop nay (xem backend placeOrder) - don chi
    // "xuat hien" that su sau khi VNPay bao thanh toan thanh cong.
    private String payUrl;
    // GET /api/order/request/{id}: don VNPay dang cho thanh toan (chua co orderId).
    // paymentStatus = "unpaid" (dang cho VNPay xac nhan) hoac "failed" (lan truoc
    // that bai, co the thanh toan lai).
    private boolean paymentPending;
    private String paymentStatus;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getOrderId() { return orderId; }
    public Order getOrder() { return order; }
    public String getPayUrl() { return payUrl; }
    public boolean isPaymentPending() { return paymentPending; }
    public String getPaymentStatus() { return paymentStatus; }
}
