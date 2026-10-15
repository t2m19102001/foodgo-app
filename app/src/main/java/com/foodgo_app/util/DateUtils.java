package com.foodgo_app.util;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

public class DateUtils {

    // Backend (MongoDB) tra ve dang ISO 8601 theo gio UTC, vi du: 2026-09-24T03:54:49.008Z
    private static final String ISO_PATTERN = "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'";
    private static final String DISPLAY_PATTERN = "dd/MM/yyyy · HH:mm";

    public static String format(String isoDate) {
        if (isoDate == null || isoDate.isEmpty()) {
            return "";
        }
        SimpleDateFormat parser = new SimpleDateFormat(ISO_PATTERN, Locale.US);
        parser.setTimeZone(TimeZone.getTimeZone("UTC"));
        try {
            Date date = parser.parse(isoDate);
            SimpleDateFormat formatter = new SimpleDateFormat(DISPLAY_PATTERN, Locale.getDefault());
            return formatter.format(date);
        } catch (ParseException e) {
            return isoDate;
        }
    }
}
