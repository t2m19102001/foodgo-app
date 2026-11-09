package com.foodgo_app.model.response;

import com.foodgo_app.model.Voucher;

public class VoucherDetailResponse {
    private boolean success;
    private String message;
    private Voucher voucher;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public Voucher getVoucher() { return voucher; }
}
