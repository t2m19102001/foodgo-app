package com.foodgo_app.model.response;

public class AddReviewRequest {
    private final String foodId;
    private final int rating;
    private final String comment;

    public AddReviewRequest(String foodId, int rating, String comment) {
        this.foodId = foodId;
        this.rating = rating;
        this.comment = comment;
    }
}
