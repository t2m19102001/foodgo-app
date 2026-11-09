package com.foodgo_app.model.response;

public class ChatSendResponse {
    private boolean success;
    private String message;
    private String reply;
    // true khi Gemini loi/timeout - reply luc nay la thong bao xin loi chung,
    // khong phai cau tra loi thuc cua AI (xem chatController.js)
    private boolean degraded;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public String getReply() { return reply; }
    public boolean isDegraded() { return degraded; }
}
