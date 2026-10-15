package com.foodgo_app.model.response;

public class ChangePasswordRequest {
    private final String oldPassword;
    private final String newPassword;

    public ChangePasswordRequest(String oldPassword, String newPassword) {
        this.oldPassword = oldPassword;
        this.newPassword = newPassword;
    }
}
