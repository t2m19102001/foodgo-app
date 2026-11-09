package com.foodgo_app.model.response;

public class ValidateVoucherResponse {
    private boolean success;
    private String message;
    private double discountAmount;
    private double finalAmount;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public double getDiscountAmount() { return discountAmount; }
    public double getFinalAmount() { return finalAmount; }
}
