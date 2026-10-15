package com.foodgo_app;

import static org.junit.Assert.assertEquals;

import com.foodgo_app.util.OrderStatusHelper;

import org.junit.Test;

import java.util.Arrays;
import java.util.Collections;

public class OrderStatusHelperTest {
    @Test
    public void adminTransitionsMatchServerContract() {
        assertEquals(Arrays.asList("confirmed", "cancelled"),
                OrderStatusHelper.getNextStatuses("pending"));
        assertEquals(Arrays.asList("shipped", "cancelled"),
                OrderStatusHelper.getNextStatuses("confirmed"));
        assertEquals(Collections.singletonList("delivered"),
                OrderStatusHelper.getNextStatuses("shipped"));
        assertEquals(Collections.emptyList(), OrderStatusHelper.getNextStatuses("delivered"));
        assertEquals(Collections.emptyList(), OrderStatusHelper.getNextStatuses("cancelled"));
    }
}
