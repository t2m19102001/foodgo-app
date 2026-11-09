package com.foodgo_app.model.response;

public class RestaurantLocationResponse {
    private boolean success;
    private String message;
    private double lat;
    private double lng;
    private String name;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public String getName() { return name; }
}
