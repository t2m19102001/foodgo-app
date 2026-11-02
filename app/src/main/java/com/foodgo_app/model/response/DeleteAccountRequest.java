package com.foodgo_app.model.response;

public class DeleteAccountRequest {
    private final String password;

    public DeleteAccountRequest(String password) {
        this.password = password;
    }
}
