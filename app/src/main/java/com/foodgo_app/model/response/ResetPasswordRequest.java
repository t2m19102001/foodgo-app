package com.foodgo_app.model.response;

public class ResetPasswordRequest {
    private final String email;
    private final String code;
    private final String newPassword;

    public ResetPasswordRequest(String email, String code, String newPassword) {
        this.email = email;
        this.code = code;
        this.newPassword = newPassword;
    }
}
