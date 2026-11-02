package com.foodgo_app.util;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import okhttp3.ResponseBody;
import retrofit2.Response;

public class ApiErrorUtils {

    // Doc errorBody thanh mot kieu cu the, vi du 409 cua "huy thanh toan" tra kem
    // don hang da ton tai. errorBody() chi doc duoc MOT lan.
    public static <T> T parseErrorBody(Response<?> response, Class<T> type) {
        ResponseBody errorBody = response.errorBody();
        if (errorBody == null) {
            return null;
        }
        try {
            return new Gson().fromJson(errorBody.string(), type);
        } catch (Exception ignored) {
            return null;
        }
    }

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
