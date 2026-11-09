package com.foodgo_app.model.response;

import java.util.List;

public class DriverListResponse {
    private boolean success;
    private String message;
    private List<DriverSummary> drivers;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<DriverSummary> getDrivers() { return drivers; }
}
