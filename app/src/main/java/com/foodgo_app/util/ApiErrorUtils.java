package com.foodgo_app.util;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import okhttp3.ResponseBody;
import retrofit2.Response;

public class ApiErrorUtils {

    // Voi ma loi 4xx/5xx, Retrofit de noi dung {success, message} trong errorBody() thay vi body()
    public static String getMessage(Response<?> response, String fallback) {
        ResponseBody errorBody = response.errorBody();
        if (errorBody == null) {
            return fallback;
        }
        try {
            JsonObject json = JsonParser.parseString(errorBody.string()).getAsJsonObject();
            if (json.has("message") && !json.get("message").isJsonNull()) {
                return json.get("message").getAsString();
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }
}
