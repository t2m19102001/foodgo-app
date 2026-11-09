package com.foodgo_app.ui.auth;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.fail;

import android.app.Application;

import com.foodgo_app.model.response.AuthResponse;
import com.foodgo_app.model.response.SimpleResponse;
import com.foodgo_app.repository.AuthRepository;
import com.foodgo_app.testutil.FakeCall;
import com.foodgo_app.util.SessionManager;
import com.google.gson.Gson;

import org.junit.Before;
import org.junit.Rule;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.io.IOException;

import androidx.arch.core.executor.testing.InstantTaskExecutorRule;
import okhttp3.MediaType;
import okhttp3.ResponseBody;
import retrofit2.Call;
import retrofit2.Response;

// Cac flow nguy co nhat cua AuthViewModel: dang nhap sai khong luu session,
// dang nhap dung phai luu dung session, va khong goi network khi input rong.
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class AuthViewModelTest {

    @Rule
    public InstantTaskExecutorRule instantTaskExecutorRule = new InstantTaskExecutorRule();

    private static final Gson GSON = new Gson();
    private Application application;

    @Before
    public void setUp() {
        application = RuntimeEnvironment.getApplication();
    }

    private static AuthResponse authResponse(String json) {
        return GSON.fromJson(json, AuthResponse.class);
    }

    private static Response<AuthResponse> errorResponse(int code, String message) {
        ResponseBody body = ResponseBody.create(
                MediaType.get("application/json"), "{\"success\":false,\"message\":\"" + message + "\"}");
        return Response.error(code, body);
    }

    @Test
    public void loginWithBlankPasswordNeverCallsTheRepository() {
        AuthRepository refusing = new AuthRepository(application) {
            @Override
            public Call<AuthResponse> login(String email, String password) {
                fail("khong duoc goi API khi input chua hop le");
                return null;
            }
        };
        AuthViewModel viewModel = new AuthViewModel(application, refusing);

        viewModel.login("a@test.local", "");

        assertEquals("Vui lòng nhập đầy đủ email và mật khẩu", viewModel.getErrorMessage().getValue());
    }

    @Test
    public void successfulLoginSavesSessionAndSignalsSuccess() {
        AuthResponse body = authResponse(
                "{\"success\":true,\"message\":\"Đăng nhập thành công\",\"token\":\"tok-123\","
                        + "\"userId\":\"user-1\",\"name\":\"Nguyen Van A\",\"isAdmin\":false,\"isDriver\":false}");
        AuthRepository fake = new AuthRepository(application) {
            @Override
            public Call<AuthResponse> login(String email, String password) {
                return new FakeCall<>(Response.success(body));
            }
        };
        AuthViewModel viewModel = new AuthViewModel(application, fake);

        viewModel.login("a@test.local", "matkhau123");

        assertEquals(Boolean.TRUE, viewModel.getAuthSuccess().getValue());
        SessionManager session = new SessionManager(application);
        assertEquals("tok-123", session.getToken());
        assertEquals("user-1", session.getUserId());
    }

    @Test
    public void wrongCredentialsDoNotCreateASession() {
        AuthRepository fake = new AuthRepository(application) {
            @Override
            public Call<AuthResponse> login(String email, String password) {
                return new FakeCall<>(errorResponse(401, "Email hoặc mật khẩu không đúng"));
            }
        };
        AuthViewModel viewModel = new AuthViewModel(application, fake);

        viewModel.login("a@test.local", "sai-roi");

        assertEquals("Email hoặc mật khẩu không đúng", viewModel.getErrorMessage().getValue());
        assertNull(viewModel.getAuthSuccess().getValue());
        assertNull(new SessionManager(application).getToken());
    }

    @Test
    public void networkFailureSurfacesAFriendlyErrorInsteadOfCrashing() {
        AuthRepository fake = new AuthRepository(application) {
            @Override
            public Call<AuthResponse> login(String email, String password) {
                return new FakeCall<>(new IOException("timeout"));
            }
        };
        AuthViewModel viewModel = new AuthViewModel(application, fake);

        viewModel.login("a@test.local", "matkhau123");

        assertEquals(Boolean.FALSE, viewModel.getLoading().getValue());
        assertEquals(true, viewModel.getErrorMessage().getValue().contains("Không thể kết nối"));
    }

    @Test
    public void requestPasswordResetSignalsSentOnSuccess() {
        SimpleResponse body = GSON.fromJson(
                "{\"success\":true,\"message\":\"Nếu email tồn tại, mã xác nhận đã được gửi\"}", SimpleResponse.class);
        AuthRepository fake = new AuthRepository(application) {
            @Override
            public Call<SimpleResponse> forgotPassword(String email) {
                return new FakeCall<>(Response.success(body));
            }
        };
        AuthViewModel viewModel = new AuthViewModel(application, fake);

        viewModel.requestPasswordReset("a@test.local");

        assertEquals(Boolean.TRUE, viewModel.getResetCodeSent().getValue());
    }
}
