package com.foodgo_app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import com.foodgo_app.model.Food;
import com.foodgo_app.model.OrderItem;
import com.foodgo_app.repository.CartRepository;
import com.foodgo_app.util.SessionManager;
import com.google.gson.Gson;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;

import java.util.Collections;
import java.util.List;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class CartRepositoryTest {

    private static final Gson GSON = new Gson();

    private Context context;
    private CartRepository cart;

    private static Food food(String id, String name, double price) {
        return GSON.fromJson(
                String.format("{\"_id\":\"%s\",\"name\":\"%s\",\"price\":%s}", id, name, price),
                Food.class);
    }

    private void signIn(String userId) {
        new SessionManager(context).saveSession("token-" + userId, userId, "Nguoi dung", false);
    }

    @Before
    public void setUp() {
        context = RuntimeEnvironment.getApplication();
        signIn("user1");
        cart = new CartRepository(context);
    }

    @Test
    public void addingTheSameFoodTwiceMergesIntoOneLine() {
        Food pho = food("food1", "Pho", 50000);
        cart.addToCart(pho);
        cart.addToCart(pho);

        assertEquals(1, cart.getCartItems().size());
        assertEquals(2, cart.getCartItems().get(0).getQuantity());
        assertEquals(2, cart.getTotalQuantity());
        assertEquals(100000, cart.getTotalAmount(), 0.001);
    }

    @Test
    public void updatingQuantityToZeroRemovesTheLine() {
        cart.addToCart(food("food1", "Pho", 50000));
        cart.addToCart(food("food2", "Com", 40000));

        cart.updateQuantity("food1", 0);

        assertEquals(1, cart.getCartItems().size());
        assertEquals("food2", cart.getCartItems().get(0).getFood().getId());
        assertEquals(40000, cart.getTotalAmount(), 0.001);
    }

    @Test
    public void onlyTheOrderedQuantityIsRemovedAfterCheckout() {
        Food pho = food("food1", "Pho", 50000);
        cart.addToCart(pho);
        cart.addToCart(pho);
        cart.addToCart(pho);
        cart.addToCart(food("food2", "Com", 40000));

        cart.removeOrderedItems(Collections.singletonList(
                new OrderItem("food1", "Pho", 50000, 2, "")));

        List<com.foodgo_app.model.CartItem> remaining = cart.getCartItems();
        assertEquals(2, remaining.size());
        assertEquals(1, remaining.get(0).getQuantity());
        assertEquals(1, remaining.get(1).getQuantity());
        assertEquals(90000, cart.getTotalAmount(), 0.001);
    }

    @Test
    public void eachAccountKeepsItsOwnCartOnTheSameDevice() {
        cart.addToCart(food("food1", "Pho", 50000));

        signIn("user2");
        CartRepository otherUserCart = new CartRepository(context);
        assertTrue(otherUserCart.getCartItems().isEmpty());

        otherUserCart.addToCart(food("food2", "Com", 40000));
        assertEquals("food2", otherUserCart.getCartItems().get(0).getFood().getId());

        signIn("user1");
        CartRepository firstUserCart = new CartRepository(context);
        assertEquals(1, firstUserCart.getCartItems().size());
        assertEquals("food1", firstUserCart.getCartItems().get(0).getFood().getId());
    }
}
