package com.foodgo_app.model.response;

public class Pagination {
    private int currentPage;
    private int totalPages;
    private int totalOrders;

    public int getCurrentPage() { return currentPage; }
    public int getTotalPages() { return totalPages; }
    public int getTotalOrders() { return totalOrders; }
}
