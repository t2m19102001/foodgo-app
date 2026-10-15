package com.foodgo_app.util;

import java.text.NumberFormat;
import java.util.Locale;

public class CurrencyUtils {

    public static String formatVnd(double amount) {
        NumberFormat format = NumberFormat.getInstance(new Locale("vi", "VN"));
        return format.format(amount) + " đ";
    }
}
