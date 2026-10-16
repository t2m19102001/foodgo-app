package com.foodgo_app;

import static org.junit.Assert.assertEquals;

import com.foodgo_app.util.ApiErrorUtils;

import org.junit.Test;

import okhttp3.MediaType;
import okhttp3.ResponseBody;
import retrofit2.Response;

public class ApiErrorUtilsTest {

    private static final MediaType JSON = MediaType.parse("application/json");

    private static ResponseBody errorBody(String content) {
        return ResponseBody.create(content, JSON);
    }

    @Test
    public void readsServerMessageFromErrorBody() {
        Response<String> response = Response.error(409,
                errorBody("{\"success\":false,\"message\":\"Đơn hàng đã được cập nhật\"}"));

        assertEquals("Đơn hàng đã được cập nhật",
                ApiErrorUtils.getMessage(response, "Thất bại"));
    }

    @Test
    public void fallsBackWhenErrorBodyIsNotUsableJson() {
        assertEquals("Thất bại",
                ApiErrorUtils.getMessage(Response.error(500, errorBody("<html>502</html>")), "Thất bại"));
        assertEquals("Thất bại",
                ApiErrorUtils.getMessage(Response.error(500, errorBody("")), "Thất bại"));
        assertEquals("Thất bại",
                ApiErrorUtils.getMessage(Response.error(400, errorBody("{\"success\":false}")), "Thất bại"));
        assertEquals("Thất bại",
                ApiErrorUtils.getMessage(Response.error(400, errorBody("{\"message\":null}")), "Thất bại"));
    }

    @Test
    public void fallsBackWhenThereIsNoErrorBodyAtAll() {
        assertEquals("Thất bại", ApiErrorUtils.getMessage(Response.success("ok"), "Thất bại"));
    }
}
