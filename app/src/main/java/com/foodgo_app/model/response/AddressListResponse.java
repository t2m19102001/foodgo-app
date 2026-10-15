package com.foodgo_app.model.response;

import com.foodgo_app.model.SavedAddress;

import java.util.List;

public class AddressListResponse {
    private boolean success;
    private String message;
    private List<SavedAddress> addresses;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<SavedAddress> getAddresses() { return addresses; }
}
