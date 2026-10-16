package com.foodgo_app;

import static org.junit.Assert.assertEquals;

import com.foodgo_app.util.DateUtils;

import org.junit.After;
import org.junit.Before;
import org.junit.Test;

import java.util.TimeZone;

public class DateUtilsTest {

    private TimeZone originalTimeZone;

    @Before
    public void fixTimeZone() {
        originalTimeZone = TimeZone.getDefault();
        TimeZone.setDefault(TimeZone.getTimeZone("Asia/Ho_Chi_Minh"));
    }

    @After
    public void restoreTimeZone() {
        TimeZone.setDefault(originalTimeZone);
    }

    @Test
    public void convertsUtcIsoDateToLocalDisplayFormat() {
        assertEquals("24/09/2026 · 10:54", DateUtils.format("2026-09-24T03:54:49.008Z"));
    }

    @Test
    public void returnsInputUnchangedWhenItCannotBeParsed() {
        assertEquals("hom qua", DateUtils.format("hom qua"));
        assertEquals("2026-09-24", DateUtils.format("2026-09-24"));
    }

    @Test
    public void returnsEmptyStringForMissingDate() {
        assertEquals("", DateUtils.format(null));
        assertEquals("", DateUtils.format(""));
    }
}
