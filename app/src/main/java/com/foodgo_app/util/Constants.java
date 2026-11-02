package com.foodgo_app.util;

import com.foodgo_app.BuildConfig;

public class Constants {
    // 10.0.2.2 la dia chi dac biet cua Android Emulator tro ve localhost cua may host
    public static final String BASE_URL = BuildConfig.API_BASE_URL;
    // Trang cong khai do backend phuc vu (backend/public/privacy.html)
    public static final String PRIVACY_POLICY_URL = BASE_URL + "privacy";

    public static final String PREF_NAME = "delivery_app_session";
    public static final String KEY_TOKEN = "token";
    public static final String KEY_USER_ID = "userId";
    public static final String KEY_USER_NAME = "userName";
    public static final String KEY_IS_ADMIN = "isAdmin";
}
