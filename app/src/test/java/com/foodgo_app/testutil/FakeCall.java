package com.foodgo_app.testutil;

import androidx.annotation.NonNull;

import java.io.IOException;

import okhttp3.Request;
import okio.Timeout;
import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

// Call gia dung trong unit test ViewModel: khong goi network nao, chi tra ve
// san mot Response (thanh cong hoac loi) hoac goi onFailure voi mot Throwable
// san, DONG BO ngay luc enqueue() duoc goi (khong can thread/Looper rieng).
public class FakeCall<T> implements Call<T> {

    private final Response<T> response;
    private final Throwable failure;

    public FakeCall(Response<T> response) {
        this.response = response;
        this.failure = null;
    }

    public FakeCall(Throwable failure) {
        this.response = null;
        this.failure = failure;
    }

    @NonNull
    @Override
    public Response<T> execute() throws IOException {
        if (failure != null) throw new IOException(failure);
        return response;
    }

    @Override
    public void enqueue(@NonNull Callback<T> callback) {
        if (failure != null) {
            callback.onFailure(this, failure);
        } else {
            callback.onResponse(this, response);
        }
    }

    @Override
    public boolean isExecuted() {
        return false;
    }

    @Override
    public void cancel() {
        // khong dung trong cac ViewModel dang test
    }

    @Override
    public boolean isCanceled() {
        return false;
    }

    @NonNull
    @Override
    @SuppressWarnings("CloneDoesntCallSuperClone")
    public Call<T> clone() {
        return this;
    }

    @NonNull
    @Override
    public Request request() {
        return new Request.Builder().url("http://test.invalid/").build();
    }

    @NonNull
    @Override
    public Timeout timeout() {
        return Timeout.NONE;
    }
}
