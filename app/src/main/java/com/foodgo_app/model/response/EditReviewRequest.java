package com.foodgo_app.model.response;

public class EditReviewRequest {
    private final int rating;
    private final String comment;

    public EditReviewRequest(int rating, String comment) {
        this.rating = rating;
        this.comment = comment;
    }
}
