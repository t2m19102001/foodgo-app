package com.foodgo_app.api;

import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import com.foodgo_app.ui.auth.LoginActivity;
import com.foodgo_app.util.SessionManager;

import java.io.IOException;

import okhttp3.Interceptor;
import okhttp3.Request;
import okhttp3.Response;

public class AuthInterceptor implements Interceptor {

    private final SessionManager sessionManager;
    private final Context appContext;

    public AuthInterceptor(Context context, SessionManager sessionManager) {
        this.appContext = context.getApplicationContext();
        this.sessionManager = sessionManager;
    }

    @Override
    public Response intercept(Chain chain) throws IOException {
        Request original = chain.request();
        String path = original.url().encodedPath();
        if (path.endsWith("/api/auth/login") || path.endsWith("/api/auth/register")) {
            return chain.proceed(original);
        }
        String token = sessionManager.getToken();

        if (token == null || token.isEmpty()) {
            return chain.proceed(original);
        }

        Request authorized = original.newBuilder()
                .header("Authorization", "Bearer " + token)
                .build();

        Response response = chain.proceed(authorized);
        if (response.code() == 401 && token.equals(sessionManager.getToken())) {
            sessionManager.clearSession();
            new Handler(Looper.getMainLooper()).post(() -> {
                Intent intent = new Intent(appContext, LoginActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                appContext.startActivity(intent);
            });
        }
        return response;
    }
}
