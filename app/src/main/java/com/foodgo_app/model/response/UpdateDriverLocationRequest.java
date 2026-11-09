package com.foodgo_app.model.response;

public class UpdateDriverLocationRequest {
    private final double lat;
    private final double lng;

    public UpdateDriverLocationRequest(double lat, double lng) {
        this.lat = lat;
        this.lng = lng;
    }
}
