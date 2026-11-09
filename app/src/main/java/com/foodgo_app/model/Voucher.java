package com.foodgo_app.model;

import com.google.gson.annotations.SerializedName;

public class Voucher {
    @SerializedName("_id")
    private String id;
    private String code;
    private String description;
    private String discountType;
    private long discountValue;
    private Long maxDiscountAmount;
    private long minOrderValue;
    private Integer usageLimit;
    private Integer usageLimitPerUser;
    private String validFrom;
    private String validUntil;
    private boolean isActive;
    private Integer usedCount;

    public String getId() { return id; }
    public String getCode() { return code; }
    public String getDescription() { return description; }
    public String getDiscountType() { return discountType; }
    public long getDiscountValue() { return discountValue; }
    public Long getMaxDiscountAmount() { return maxDiscountAmount; }
    public long getMinOrderValue() { return minOrderValue; }
    public Integer getUsageLimit() { return usageLimit; }
    public Integer getUsageLimitPerUser() { return usageLimitPerUser; }
    public String getValidFrom() { return validFrom; }
    public String getValidUntil() { return validUntil; }
    public boolean isActive() { return isActive; }
    public Integer getUsedCount() { return usedCount; }

    public boolean isPercent() { return "percent".equals(discountType); }
}
