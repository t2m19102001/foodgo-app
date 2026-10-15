package com.foodgo_app.model.response;

import com.foodgo_app.model.User;

public class ProfileResponse {
    private boolean success;
    private String message;
    private User user;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public User getUser() { return user; }
}
