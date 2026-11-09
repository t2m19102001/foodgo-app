package com.foodgo_app.model.response;

// Dung chung cho create/update: PUT la REPLACE TOAN BO (khong phai merge tung
// truong), nen man AddEditVoucherActivity luon gui du moi truong - xem
// voucherController.parseVoucherBody (backend) doi dung hop dong nay.
public class SaveVoucherRequest {
    private final String code;
    private final String description;
    private final String discountType;
    private final long discountValue;
    private final Long maxDiscountAmount;
    private final long minOrderValue;
    private final Integer usageLimit;
    private final Integer usageLimitPerUser;
    private final String validFrom;
    private final String validUntil;
    private final boolean isActive;

    public SaveVoucherRequest(String code, String description, String discountType, long discountValue,
                               Long maxDiscountAmount, long minOrderValue, Integer usageLimit,
                               Integer usageLimitPerUser, String validFrom, String validUntil, boolean isActive) {
        this.code = code;
        this.description = description;
        this.discountType = discountType;
        this.discountValue = discountValue;
        this.maxDiscountAmount = maxDiscountAmount;
        this.minOrderValue = minOrderValue;
        this.usageLimit = usageLimit;
        this.usageLimitPerUser = usageLimitPerUser;
        this.validFrom = validFrom;
        this.validUntil = validUntil;
        this.isActive = isActive;
    }
}
