package com.foodgo_app;

import static org.junit.Assert.assertEquals;

import com.foodgo_app.util.PaymentStatusHelper;

import org.junit.Test;

public class PaymentStatusHelperTest {

    @Test
    public void mapsEveryPaymentStatusToVietnameseLabel() {
        assertEquals("Đã thanh toán", PaymentStatusHelper.getDisplayName(PaymentStatusHelper.PAID));
        assertEquals("Thanh toán thất bại", PaymentStatusHelper.getDisplayName(PaymentStatusHelper.FAILED));
        assertEquals("Chưa thanh toán", PaymentStatusHelper.getDisplayName(PaymentStatusHelper.UNPAID));
    }

    @Test
    public void unknownStatusFallsBackToUnpaidAndNullIsHandled() {
        assertEquals("Chưa thanh toán", PaymentStatusHelper.getDisplayName("refunded"));
        assertEquals("Không xác định", PaymentStatusHelper.getDisplayName(null));
    }
}
