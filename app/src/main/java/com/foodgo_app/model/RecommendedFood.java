package com.foodgo_app.model;

// "reason" da duoc backend dung tu so lieu THAT de dung san (xem
// recommendationController.js) - app chi hien thi, khong tu sinh them.
public class RecommendedFood {
    private Food food;
    private String reason;

    public Food getFood() { return food; }
    public String getReason() { return reason; }
}
