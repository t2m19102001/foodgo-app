package com.foodgo_app.model.response;

import com.foodgo_app.model.RecommendedFood;

import java.util.List;

public class HomeRecommendationsResponse {
    private boolean success;
    private String message;
    private List<RecommendedFood> forYou;
    private List<RecommendedFood> topRated;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<RecommendedFood> getForYou() { return forYou; }
    public List<RecommendedFood> getTopRated() { return topRated; }
}
