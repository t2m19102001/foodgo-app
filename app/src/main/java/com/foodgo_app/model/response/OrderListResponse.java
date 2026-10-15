package com.foodgo_app.model.response;

import com.foodgo_app.model.Order;

import java.util.List;

public class OrderListResponse {
    private boolean success;
    private String message;
    private List<Order> orders;
    private Pagination pagination;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<Order> getOrders() { return orders; }
    public Pagination getPagination() { return pagination; }
}
