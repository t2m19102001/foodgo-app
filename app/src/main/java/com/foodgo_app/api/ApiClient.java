package com.foodgo_app.api;

import android.content.Context;

import com.foodgo_app.BuildConfig;
import com.foodgo_app.util.Constants;
import com.foodgo_app.util.SessionManager;

import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.logging.HttpLoggingInterceptor;
import retrofit2.Retrofit;
import retrofit2.converter.gson.GsonConverterFactory;

public class ApiClient {

    private static Retrofit retrofit;
    private static ApiService apiService;

    public static ApiService getApiService(Context context) {
        if (apiService == null) {
            SessionManager sessionManager = new SessionManager(context);

            OkHttpClient.Builder clientBuilder = new OkHttpClient.Builder()
                    .addInterceptor(new AuthInterceptor(context, sessionManager))
                    .connectTimeout(15, TimeUnit.SECONDS)
                    .readTimeout(15, TimeUnit.SECONDS);
            if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor logging = new HttpLoggingInterceptor();
                logging.redactHeader("Authorization");
                logging.setLevel(HttpLoggingInterceptor.Level.BASIC);
                clientBuilder.addInterceptor(logging);
            }
            OkHttpClient client = clientBuilder.build();

            retrofit = new Retrofit.Builder()
                    .baseUrl(Constants.BASE_URL)
                    .client(client)
                    .addConverterFactory(GsonConverterFactory.create())
                    .build();

            apiService = retrofit.create(ApiService.class);
        }
        return apiService;
    }
}
