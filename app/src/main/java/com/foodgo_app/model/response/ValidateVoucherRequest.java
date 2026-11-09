package com.foodgo_app.model.response;

public class ValidateVoucherRequest {
    private final String code;
    private final double orderAmount;

    public ValidateVoucherRequest(String code, double orderAmount) {
        this.code = code;
        this.orderAmount = orderAmount;
    }
}
