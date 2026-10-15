package com.foodgo_app.model.response;

public class RegisterRequest {
    private final String name;
    private final String email;
    private final String password;
    private final String phone;

    public RegisterRequest(String name, String email, String password, String phone) {
        this.name = name;
        this.email = email;
        this.password = password;
        this.phone = phone;
    }
}
