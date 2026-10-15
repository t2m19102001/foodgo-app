package com.foodgo_app.model.response;

import java.util.List;

public class OrderStatsResponse {
    private boolean success;
    private String message;
    private double totalRevenue;
    private int totalOrders;
    private List<StatusCount> byStatus;
    private List<DailyRevenue> last7Days;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public double getTotalRevenue() { return totalRevenue; }
    public int getTotalOrders() { return totalOrders; }
    public List<StatusCount> getByStatus() { return byStatus; }
    public List<DailyRevenue> getLast7Days() { return last7Days; }

    public static class StatusCount {
        private String status;
        private int count;
        private double total;

        public String getStatus() { return status; }
        public int getCount() { return count; }
        public double getTotal() { return total; }
    }

    public static class DailyRevenue {
        private String date;
        private double revenue;
        private int count;

        public String getDate() { return date; }
        public double getRevenue() { return revenue; }
        public int getCount() { return count; }
    }
}
