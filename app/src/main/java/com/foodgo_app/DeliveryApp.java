package com.foodgo_app;

import android.app.Application;

import com.foodgo_app.util.CrashReporter;
import com.foodgo_app.util.SessionManager;

public class DeliveryApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        CrashReporter.init(this);
        CrashReporter.setUserId(new SessionManager(this).getUserId());
    }
}
