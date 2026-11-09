package com.foodgo_app.model.response;

import com.foodgo_app.model.Voucher;

import java.util.List;

public class VoucherListResponse {
    private boolean success;
    private String message;
    private List<Voucher> vouchers;

    public boolean isSuccess() { return success; }
    public String getMessage() { return message; }
    public List<Voucher> getVouchers() { return vouchers; }
}
