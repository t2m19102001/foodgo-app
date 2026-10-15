package com.foodgo_app.util;

public class ImageUrlHelper {

    public static String getImageUrl(String filename) {
        if (filename == null || filename.isEmpty()) {
            return null;
        }
        if (filename.startsWith("http")) {
            return filename;
        }
        return Constants.BASE_URL + "uploads/" + filename;
    }
}
