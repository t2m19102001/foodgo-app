package com.foodgo_app.util;

import android.content.Context;
import android.content.SharedPreferences;

public class SessionManager {

    private final SharedPreferences prefs;

    public SessionManager(Context context) {
        prefs = context.getApplicationContext()
                .getSharedPreferences(Constants.PREF_NAME, Context.MODE_PRIVATE);
    }

    public void saveSession(String token, String userId, String userName, boolean isAdmin) {
        prefs.edit()
                .putString(Constants.KEY_TOKEN, token)
                .putString(Constants.KEY_USER_ID, userId)
                .putString(Constants.KEY_USER_NAME, userName)
                .putBoolean(Constants.KEY_IS_ADMIN, isAdmin)
                .apply();
    }

    public String getToken() {
        return prefs.getString(Constants.KEY_TOKEN, null);
    }

    public String getUserId() {
        return prefs.getString(Constants.KEY_USER_ID, null);
    }

    public String getUserName() {
        return prefs.getString(Constants.KEY_USER_NAME, null);
    }

    public boolean isAdmin() {
        return prefs.getBoolean(Constants.KEY_IS_ADMIN, false);
    }

    public boolean isLoggedIn() {
        return getToken() != null;
    }

    public void clearSession() {
        prefs.edit().clear().apply();
    }
}
