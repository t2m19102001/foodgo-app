package com.foodgo_app.util;

import android.content.ContentResolver;
import android.content.Context;
import android.net.Uri;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.RequestBody;

// Dung chung cho cac form admin (mon an, danh muc) can gui multipart kem anh
public class MultipartUtils {

    public static RequestBody textPart(String value) {
        return RequestBody.create(value != null ? value : "", MediaType.parse("text/plain"));
    }

    // Doc toan bo noi dung Uri (tu Photo Picker) thanh MultipartBody.Part ten field "image"
    public static MultipartBody.Part imagePart(Context context, Uri uri) throws IOException {
        ContentResolver resolver = context.getContentResolver();
        String mimeType = resolver.getType(uri);
        if (mimeType == null) {
            mimeType = "image/jpeg";
        }
        byte[] bytes = readBytes(resolver, uri);
        String extension = mimeType.contains("png") ? ".png"
                : mimeType.contains("gif") ? ".gif"
                : mimeType.contains("webp") ? ".webp"
                : ".jpg";
        RequestBody requestBody = RequestBody.create(bytes, MediaType.parse(mimeType));
        return MultipartBody.Part.createFormData("image", "upload" + extension, requestBody);
    }

    private static byte[] readBytes(ContentResolver resolver, Uri uri) throws IOException {
        try (InputStream input = resolver.openInputStream(uri)) {
            if (input == null) {
                throw new IOException("Không mở được ảnh đã chọn");
            }
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }
}
