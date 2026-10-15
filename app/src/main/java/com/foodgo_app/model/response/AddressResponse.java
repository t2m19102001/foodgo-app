package com.foodgo_app.model.response;

import com.foodgo_app.model.SavedAddress;

public class AddressResponse {
    private boolean success;
    private String message;
    private SavedAddress address;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public SavedAddress getAddress() { return address; }
}
