package com.foodgo_app.model.response;

public class VnpayCreateResponse {
    private boolean success;
    private String message;
    private String payUrl;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getPayUrl() { return payUrl; }
}
