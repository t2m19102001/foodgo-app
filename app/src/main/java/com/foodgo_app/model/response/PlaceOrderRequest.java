package com.foodgo_app.model.response;

import com.foodgo_app.model.Address;
import com.foodgo_app.model.OrderItem;

import java.util.List;

public class PlaceOrderRequest {
    private final List<OrderItem> items;
    private final double amount;
    private final Address address;
    private final String clientRequestId;
    private final String paymentMethod;

    public PlaceOrderRequest(List<OrderItem> items, double amount, Address address, String clientRequestId,
                              String paymentMethod) {
        this.items = items;
        this.amount = amount;
        this.address = address;
        this.clientRequestId = clientRequestId;
        this.paymentMethod = paymentMethod;
    }

    public String getClientRequestId() { return clientRequestId; }
    public List<OrderItem> getItems() { return items; }
    public String getPaymentMethod() { return paymentMethod; }
}
