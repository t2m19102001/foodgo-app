package com.foodgo_app.model.response;

public class AuthResponse {
    private boolean success;
    private String message;
    private String token;
    private String userId;
    private String name;
    private String image;
    private boolean isAdmin;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getToken() { return token; }
    public String getUserId() { return userId; }
    public String getName() { return name; }
    public String getImage() { return image; }
    public boolean isAdmin() { return isAdmin; }
}
