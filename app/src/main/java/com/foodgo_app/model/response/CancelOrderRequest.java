package com.foodgo_app.model.response;

public class CancelOrderRequest {
    private final String reason;

    public CancelOrderRequest(String reason) {
        this.reason = reason;
    }
}
