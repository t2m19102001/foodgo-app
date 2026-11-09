package com.foodgo_app.model;

// Vi tri tai xe (module Location Sharing) - chi xuat hien trong Order khi
// status='shipped' va da gan tai xe, xem backend/db/mappers.js. Tu dong bien
// mat khi don khong con dang giao (bao mat: khong lo vi tri sau khi hoan tat).
public class DriverLocation {
    private double lat;
    private double lng;
    private String updatedAt;

    public double getLat() { return lat; }
    public double getLng() { return lng; }
    public String getUpdatedAt() { return updatedAt; }
}
