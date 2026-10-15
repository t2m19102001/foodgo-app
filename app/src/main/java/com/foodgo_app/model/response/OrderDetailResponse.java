package com.foodgo_app.model.response;

import com.foodgo_app.model.Order;

public class OrderDetailResponse {
    private boolean success;
    private String message;
    private String orderId;
    private Order order;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getOrderId() { return orderId; }
    public Order getOrder() { return order; }
}
