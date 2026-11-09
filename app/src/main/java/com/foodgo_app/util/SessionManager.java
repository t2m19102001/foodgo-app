package com.foodgo_app.util;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;

import androidx.security.crypto.EncryptedSharedPreferences;
import androidx.security.crypto.MasterKey;

import java.io.IOException;
import java.security.GeneralSecurityException;

public class SessionManager {

    // Robolectric (unit test tren JVM) khong co AndroidKeyStore provider thuc,
    // EncryptedSharedPreferences se nem NoSuchAlgorithmException ngay luc tao.
    // Build.FINGERPRINT == "robolectric" la cach Robolectric tu nhan dang minh,
    // dung rong rai de tach nhanh test khoi thiet bi/emulator thuc - cai sau
    // van dung EncryptedSharedPreferences binh thuong.
    private static final boolean IS_ROBOLECTRIC = "robolectric".equals(Build.FINGERPRINT);

    private final SharedPreferences prefs;

    public SessionManager(Context context) {
        prefs = buildPrefs(context.getApplicationContext());
    }

    // Token JWT + co isAdmin/isDriver truoc day nam plaintext trong
    // SharedPreferences thuong - doc duoc tren thiet bi da root du da khoa
    // adb backup (allowBackup=false). EncryptedSharedPreferences ma hoa ca key
    // va value bang mot MasterKey luu trong Android Keystore (khong xuat ra
    // duoc khoi thiet bi). Neu file cu (ban chua ma hoa) con ton tai tu ban
    // cai truoc, doc no se nem GeneralSecurityException/IOException (sai dinh
    // dang) - xu ly bang cach xoa file cu va tao lai rong, tuong duong voi
    // dang xuat, an toan hon la crash app.
    private static SharedPreferences buildPrefs(Context appContext) {
        if (IS_ROBOLECTRIC) {
            return appContext.getSharedPreferences(Constants.PREF_NAME, Context.MODE_PRIVATE);
        }
        try {
            MasterKey masterKey = new MasterKey.Builder(appContext)
                    .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                    .build();
            return EncryptedSharedPreferences.create(
                    appContext,
                    Constants.PREF_NAME,
                    masterKey,
                    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
        } catch (GeneralSecurityException | IOException e) {
            appContext.getSharedPreferences(Constants.PREF_NAME, Context.MODE_PRIVATE)
                    .edit().clear().commit();
            try {
                MasterKey masterKey = new MasterKey.Builder(appContext)
                        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                        .build();
                return EncryptedSharedPreferences.create(
                        appContext,
                        Constants.PREF_NAME,
                        masterKey,
                        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM);
            } catch (GeneralSecurityException | IOException retryFailure) {
                throw new RuntimeException("Khong the khoi tao luu tru phien dang nhap", retryFailure);
            }
        }
    }

    public void saveSession(String token, String userId, String userName, boolean isAdmin, boolean isDriver) {
        prefs.edit()
                .putString(Constants.KEY_TOKEN, token)
                .putString(Constants.KEY_USER_ID, userId)
                .putString(Constants.KEY_USER_NAME, userName)
                .putBoolean(Constants.KEY_IS_ADMIN, isAdmin)
                .putBoolean(Constants.KEY_IS_DRIVER, isDriver)
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

    public boolean isDriver() {
        return prefs.getBoolean(Constants.KEY_IS_DRIVER, false);
    }

    public boolean isLoggedIn() {
        return getToken() != null;
    }

    public void clearSession() {
        prefs.edit().clear().apply();
    }
}
