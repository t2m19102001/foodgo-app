package com.foodgo_app.util;

import java.util.Locale;

// Khoang cach DUONG THANG (Haversine), KHONG phai khoang cach lai xe thuc -
// tranh goi Directions/Distance Matrix API (can bat billing + tinh phi theo
// request). Day la gioi han da ghi ro trong plan module Maps.
public class DistanceUtils {

    private static final double EARTH_RADIUS_KM = 6371.0;

    private DistanceUtils() {
    }

    public static double haversineKm(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return EARTH_RADIUS_KM * c;
    }

    // "~2,3 km" - "~" nhac nguoi dung day la khoang cach duong thang, khong
    // phai quang duong giao hang thuc te
    public static String formatKm(double km) {
        return String.format(Locale.getDefault(), "~%.1f km", km);
    }
}
