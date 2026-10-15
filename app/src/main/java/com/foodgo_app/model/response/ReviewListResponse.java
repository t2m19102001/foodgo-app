package com.foodgo_app.model.response;

import com.foodgo_app.model.Review;

import java.util.List;

public class ReviewListResponse {
    private boolean success;
    private String message;
    private List<Review> reviews;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<Review> getReviews() { return reviews; }
}
