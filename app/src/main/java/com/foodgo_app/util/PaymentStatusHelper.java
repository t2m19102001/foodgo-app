package com.foodgo_app.util;

import android.content.Context;
import android.content.res.ColorStateList;
import android.widget.TextView;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.ViewCompat;

import com.foodgo_app.R;

public class PaymentStatusHelper {

    public static final String UNPAID = "unpaid";
    public static final String PAID = "paid";
    public static final String FAILED = "failed";

    public static String getDisplayName(String paymentStatus) {
        if (paymentStatus == null) {
            return "Không xác định";
        }
        switch (paymentStatus) {
            case PAID:
                return "Đã thanh toán";
            case FAILED:
                return "Thanh toán thất bại";
            case UNPAID:
            default:
                return "Chưa thanh toán";
        }
    }

    public static int getColorRes(String paymentStatus) {
        if (PAID.equals(paymentStatus)) {
            return R.color.status_delivered;
        }
        if (FAILED.equals(paymentStatus)) {
            return R.color.status_cancelled;
        }
        return R.color.status_pending;
    }

    public static int getColor(Context context, String paymentStatus) {
        return ContextCompat.getColor(context, getColorRes(paymentStatus));
    }

    public static void applyChip(TextView chip, String paymentStatus) {
        int color = getColor(chip.getContext(), paymentStatus);
        chip.setText(getDisplayName(paymentStatus));
        chip.setTextColor(color);
        ViewCompat.setBackgroundTintList(chip,
                ColorStateList.valueOf(ColorUtils.setAlphaComponent(color, 0x26)));
    }
}
