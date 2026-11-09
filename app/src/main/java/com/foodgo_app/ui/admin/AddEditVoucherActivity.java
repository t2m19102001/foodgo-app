package com.foodgo_app.ui.admin;

import android.app.DatePickerDialog;
import android.os.Bundle;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.RadioGroup;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.lifecycle.ViewModelProvider;

import com.google.android.material.appbar.MaterialToolbar;
import com.google.android.material.button.MaterialButton;
import com.google.android.material.materialswitch.MaterialSwitch;
import com.google.android.material.textfield.TextInputEditText;
import com.google.android.material.textfield.TextInputLayout;
import com.foodgo_app.R;
import com.foodgo_app.model.response.SaveVoucherRequest;

import java.text.ParseException;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

public class AddEditVoucherActivity extends AppCompatActivity {

    // Dinh dang gui len server (ISO 8601 co offset) - Postgres timestamptz hieu
    // dung du admin chon gio dia phuong nao, khong can quan tam server o mui gio nao.
    private static final SimpleDateFormat ISO_FORMAT =
            new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ssXXX", Locale.US);
    private static final SimpleDateFormat DISPLAY_FORMAT =
            new SimpleDateFormat("dd/MM/yyyy", Locale.US);

    private AddEditVoucherViewModel viewModel;
    private String voucherId;
    private boolean editMode;

    private TextInputLayout layoutMaxDiscount;
    private TextInputEditText editCode;
    private TextInputEditText editDescription;
    private RadioGroup radioGroupDiscountType;
    private TextInputEditText editDiscountValue;
    private TextInputEditText editMaxDiscountAmount;
    private TextInputEditText editMinOrderValue;
    private TextInputEditText editUsageLimit;
    private TextInputEditText editUsageLimitPerUser;
    private TextInputEditText editValidFrom;
    private TextInputEditText editValidUntil;
    private MaterialSwitch switchIsActive;
    private TextView textError;
    private ProgressBar progressBar;
    private MaterialButton btnSubmit;

    // null = chua chon
    private Calendar validFromDate;
    private Calendar validUntilDate;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_edit_voucher);

        voucherId = getIntent().getStringExtra("voucherId");
        editMode = voucherId != null && !voucherId.isEmpty();

        MaterialToolbar toolbar = findViewById(R.id.toolbar);
        toolbar.setNavigationOnClickListener(v -> finish());
        toolbar.setTitle(editMode ? "Sửa mã giảm giá" : "Thêm mã giảm giá");

        layoutMaxDiscount = findViewById(R.id.layout_max_discount);
        editCode = findViewById(R.id.edit_code);
        editDescription = findViewById(R.id.edit_description);
        radioGroupDiscountType = findViewById(R.id.radio_group_discount_type);
        editDiscountValue = findViewById(R.id.edit_discount_value);
        editMaxDiscountAmount = findViewById(R.id.edit_max_discount_amount);
        editMinOrderValue = findViewById(R.id.edit_min_order_value);
        editUsageLimit = findViewById(R.id.edit_usage_limit);
        editUsageLimitPerUser = findViewById(R.id.edit_usage_limit_per_user);
        editValidFrom = findViewById(R.id.edit_valid_from);
        editValidUntil = findViewById(R.id.edit_valid_until);
        switchIsActive = findViewById(R.id.switch_is_active);
        textError = findViewById(R.id.text_error);
        progressBar = findViewById(R.id.progress_bar);
        btnSubmit = findViewById(R.id.btn_submit);

        radioGroupDiscountType.setOnCheckedChangeListener((group, checkedId) ->
                updateMaxDiscountVisibility());
        editValidFrom.setOnClickListener(v -> pickDate(true));
        editValidUntil.setOnClickListener(v -> pickDate(false));

        if (editMode) prefillFromIntent();
        updateMaxDiscountVisibility();

        viewModel = new ViewModelProvider(this).get(AddEditVoucherViewModel.class);

        btnSubmit.setOnClickListener(v -> submit());

        observeViewModel();
    }

    private void prefillFromIntent() {
        Bundle extras = getIntent().getExtras();
        if (extras == null) return;

        editCode.setText(extras.getString("code"));
        editDescription.setText(extras.getString("description"));
        boolean isPercent = "percent".equals(extras.getString("discountType"));
        radioGroupDiscountType.check(isPercent ? R.id.radio_discount_percent : R.id.radio_discount_fixed);
        editDiscountValue.setText(String.valueOf(extras.getLong("discountValue", 0)));
        if (extras.containsKey("maxDiscountAmount")) {
            editMaxDiscountAmount.setText(String.valueOf(extras.getLong("maxDiscountAmount", 0)));
        }
        editMinOrderValue.setText(String.valueOf(extras.getLong("minOrderValue", 0)));
        if (extras.containsKey("usageLimit")) {
            editUsageLimit.setText(String.valueOf(extras.getInt("usageLimit", 0)));
        }
        if (extras.containsKey("usageLimitPerUser")) {
            editUsageLimitPerUser.setText(String.valueOf(extras.getInt("usageLimitPerUser", 0)));
        }
        validFromDate = parseIsoToCalendar(extras.getString("validFrom"));
        validUntilDate = parseIsoToCalendar(extras.getString("validUntil"));
        refreshDateFields();
        switchIsActive.setChecked(extras.getBoolean("isActive", true));
    }

    @Nullable
    private static Calendar parseIsoToCalendar(@Nullable String iso) {
        if (iso == null || iso.isEmpty()) return null;
        try {
            // Server tra ve dang "2026-12-25T00:00:00.000Z" (UTC) - parse truc tiep
            SimpleDateFormat parser = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US);
            parser.setTimeZone(java.util.TimeZone.getTimeZone("UTC"));
            Date date = parser.parse(iso.length() >= 19 ? iso.substring(0, 19) : iso);
            Calendar calendar = Calendar.getInstance();
            calendar.setTime(date);
            return calendar;
        } catch (ParseException | IllegalArgumentException e) {
            return null;
        }
    }

    private void pickDate(boolean isFrom) {
        Calendar current = isFrom ? validFromDate : validUntilDate;
        Calendar base = current != null ? current : Calendar.getInstance();
        new DatePickerDialog(this, (picker, year, month, dayOfMonth) -> {
            Calendar selected = Calendar.getInstance();
            selected.set(year, month, dayOfMonth, isFrom ? 0 : 23, isFrom ? 0 : 59, isFrom ? 0 : 59);
            if (isFrom) validFromDate = selected; else validUntilDate = selected;
            refreshDateFields();
        }, base.get(Calendar.YEAR), base.get(Calendar.MONTH), base.get(Calendar.DAY_OF_MONTH)).show();
    }

    private void refreshDateFields() {
        editValidFrom.setText(validFromDate != null ? DISPLAY_FORMAT.format(validFromDate.getTime()) : "");
        editValidUntil.setText(validUntilDate != null ? DISPLAY_FORMAT.format(validUntilDate.getTime()) : "");
    }

    private void updateMaxDiscountVisibility() {
        boolean isPercent = radioGroupDiscountType.getCheckedRadioButtonId() == R.id.radio_discount_percent;
        layoutMaxDiscount.setVisibility(isPercent ? View.VISIBLE : View.GONE);
        if (!isPercent) editMaxDiscountAmount.setText("");
    }

    @Nullable
    private static Long parseOptionalLong(TextInputEditText field) {
        String text = field.getText() != null ? field.getText().toString().trim() : "";
        if (text.isEmpty()) return null;
        try {
            return Long.parseLong(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    @Nullable
    private static Integer parseOptionalInt(TextInputEditText field) {
        String text = field.getText() != null ? field.getText().toString().trim() : "";
        if (text.isEmpty()) return null;
        try {
            return Integer.parseInt(text);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void submit() {
        String code = editCode.getText() != null ? editCode.getText().toString().trim() : "";
        if (code.isEmpty()) {
            showError("Vui lòng nhập mã giảm giá");
            return;
        }
        boolean isPercent = radioGroupDiscountType.getCheckedRadioButtonId() == R.id.radio_discount_percent;
        Long discountValue = parseOptionalLong(editDiscountValue);
        if (discountValue == null || discountValue <= 0) {
            showError("Vui lòng nhập giá trị giảm hợp lệ");
            return;
        }
        if (isPercent && discountValue > 100) {
            showError("Giảm theo % phải trong khoảng 1-100");
            return;
        }
        Long maxDiscountAmount = isPercent ? parseOptionalLong(editMaxDiscountAmount) : null;
        Long minOrderValueBoxed = parseOptionalLong(editMinOrderValue);
        long minOrderValue = minOrderValueBoxed != null ? minOrderValueBoxed : 0;
        Integer usageLimit = parseOptionalInt(editUsageLimit);
        Integer usageLimitPerUser = parseOptionalInt(editUsageLimitPerUser);
        if (validFromDate != null && validUntilDate != null && !validFromDate.before(validUntilDate)) {
            showError("Ngày bắt đầu phải trước ngày kết thúc");
            return;
        }

        SaveVoucherRequest request = new SaveVoucherRequest(
                code,
                editDescription.getText() != null ? editDescription.getText().toString().trim() : "",
                isPercent ? "percent" : "fixed",
                discountValue,
                maxDiscountAmount,
                minOrderValue,
                usageLimit,
                usageLimitPerUser,
                validFromDate != null ? ISO_FORMAT.format(validFromDate.getTime()) : null,
                validUntilDate != null ? ISO_FORMAT.format(validUntilDate.getTime()) : null,
                switchIsActive.isChecked()
        );

        if (editMode) {
            viewModel.update(voucherId, request);
        } else {
            viewModel.create(request);
        }
    }

    private void showError(String message) {
        textError.setText(message);
        textError.setVisibility(View.VISIBLE);
    }

    private void observeViewModel() {
        viewModel.getLoading().observe(this, isLoading -> {
            boolean loading = Boolean.TRUE.equals(isLoading);
            progressBar.setVisibility(loading ? View.VISIBLE : View.GONE);
            btnSubmit.setEnabled(!loading);
        });

        viewModel.getError().observe(this, message -> {
            if (message != null && !message.isEmpty()) {
                showError(message);
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
                viewModel.clearError();
            }
        });

        viewModel.getSubmitSuccess().observe(this, success -> {
            if (Boolean.TRUE.equals(success)) {
                Toast.makeText(this, editMode ? "Cập nhật mã giảm giá thành công" : "Thêm mã giảm giá thành công",
                        Toast.LENGTH_SHORT).show();
                finish();
            }
        });
    }
}
