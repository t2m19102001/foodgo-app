package com.foodgo_app.util;

import android.content.Context;
import android.content.res.ColorStateList;
import android.widget.TextView;

import androidx.core.content.ContextCompat;
import androidx.core.graphics.ColorUtils;
import androidx.core.view.ViewCompat;

import com.foodgo_app.R;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;

public class OrderStatusHelper {

    public static final String PENDING = "pending";
    public static final String CONFIRMED = "confirmed";
    public static final String SHIPPED = "shipped";
    public static final String DELIVERED = "delivered";
    public static final String CANCELLED = "cancelled";

    public static String getDisplayName(String status) {
        if (status == null) {
            return "Không xác định";
        }
        switch (status) {
            case PENDING:
                return "Chờ xác nhận";
            case CONFIRMED:
                return "Đã xác nhận";
            case SHIPPED:
                return "Đang giao";
            case DELIVERED:
                return "Đã giao";
            case CANCELLED:
                return "Đã hủy";
            default:
                return status;
        }
    }

    public static int getColorRes(String status) {
        if (status == null) {
            return R.color.text_secondary;
        }
        switch (status) {
            case PENDING:
                return R.color.status_pending;
            case CONFIRMED:
                return R.color.status_confirmed;
            case SHIPPED:
                return R.color.status_shipped;
            case DELIVERED:
                return R.color.status_delivered;
            case CANCELLED:
                return R.color.status_cancelled;
            default:
                return R.color.text_secondary;
        }
    }

    public static int getColor(Context context, String status) {
        return ContextCompat.getColor(context, getColorRes(status));
    }

    // Nhan trang thai: chu mau dam, nen cung mau nhung nhat (do trong suot ~15%)
    public static void applyChip(TextView chip, String status) {
        int color = getColor(chip.getContext(), status);
        chip.setText(getDisplayName(status));
        chip.setTextColor(color);
        ViewCompat.setBackgroundTintList(chip,
                ColorStateList.valueOf(ColorUtils.setAlphaComponent(color, 0x26)));
    }

    // Cac trang thai ke tiep ma admin duoc phep chuyen sang. Don da giao hoac da huy
    // la trang thai ket thuc nen tra ve danh sach rong (backend cung chan tuong ung)
    public static List<String> getNextStatuses(String status) {
        if (status == null) {
            return Collections.emptyList();
        }
        switch (status) {
            case PENDING:
                return Arrays.asList(CONFIRMED, CANCELLED);
            case CONFIRMED:
                return Arrays.asList(SHIPPED, CANCELLED);
            case SHIPPED:
                return Collections.singletonList(DELIVERED);
            default:
                return Collections.emptyList();
        }
    }
}
