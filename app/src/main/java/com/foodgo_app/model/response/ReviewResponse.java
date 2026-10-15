package com.foodgo_app.model.response;

import com.foodgo_app.model.Review;

public class ReviewResponse {
    private boolean success;
    private String message;
    private Review review;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Review getReview() { return review; }
}
