package com.foodgo_app.util;

import android.content.Context;

import com.foodgo_app.BuildConfig;
import com.google.firebase.FirebaseApp;
import com.google.firebase.crashlytics.FirebaseCrashlytics;

// Bao loi qua Firebase Crashlytics. Chi hoat dong khi build co file
// app/google-services.json (xem app/build.gradle.kts); khong co file thi
// FirebaseApp khong khoi tao va moi ham o day la no-op, app van chay binh thuong.
public final class CrashReporter {

    private static boolean enabled;

    private CrashReporter() {}

    public static void init(Context context) {
        try {
            enabled = !FirebaseApp.getApps(context).isEmpty();
            if (enabled) {
                // Ban debug khong gui bao cao de khong lan voi loi cua nguoi dung that
                FirebaseCrashlytics.getInstance().setCrashlyticsCollectionEnabled(!BuildConfig.DEBUG);
            }
        } catch (RuntimeException e) {
            enabled = false;
        }
    }

    // Gan bao cao loi voi tai khoan (chi userId, khong gui email/ten). null = dang xuat
    public static void setUserId(String userId) {
        if (!enabled) return;
        FirebaseCrashlytics.getInstance().setUserId(userId != null ? userId : "");
    }

    // Loi khong lam app dung nhung can biet (vi du API tra du lieu khong doc duoc)
    public static void recordNonFatal(Throwable throwable) {
        if (!enabled || throwable == null) return;
        FirebaseCrashlytics.getInstance().recordException(throwable);
    }
}
