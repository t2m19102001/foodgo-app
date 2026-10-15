package com.foodgo_app.repository;

import android.content.Context;
import android.content.SharedPreferences;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.foodgo_app.model.CartItem;
import com.foodgo_app.model.Food;
import com.foodgo_app.model.OrderItem;
import com.foodgo_app.util.SessionManager;

import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

public class CartRepository {

    private static final String PREF_NAME = "delivery_app_cart";
    private static final String KEY_CART = "cart_items_";

    private final SharedPreferences prefs;
    private final SessionManager sessionManager;
    private final Gson gson = new Gson();

    public CartRepository(Context context) {
        prefs = context.getApplicationContext().getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE);
        sessionManager = new SessionManager(context);
    }

    private String cartKey() {
        String userId = sessionManager.getUserId();
        return KEY_CART + (userId != null ? userId : "guest");
    }

    public List<CartItem> getCartItems() {
        String json = prefs.getString(cartKey(), null);
        if (json == null) {
            return new ArrayList<>();
        }
        Type type = new TypeToken<ArrayList<CartItem>>() {}.getType();
        List<CartItem> items = gson.fromJson(json, type);
        return items != null ? items : new ArrayList<>();
    }

    public void addToCart(Food food) {
        List<CartItem> items = getCartItems();
        for (CartItem item : items) {
            if (item.getFood().getId().equals(food.getId())) {
                item.setQuantity(item.getQuantity() + 1);
                saveCart(items);
                return;
            }
        }
        items.add(new CartItem(food, 1));
        saveCart(items);
    }

    public void updateQuantity(String foodId, int quantity) {
        List<CartItem> items = getCartItems();
        List<CartItem> updated = new ArrayList<>();
        for (CartItem item : items) {
            if (item.getFood().getId().equals(foodId)) {
                if (quantity > 0) {
                    item.setQuantity(quantity);
                    updated.add(item);
                }
            } else {
                updated.add(item);
            }
        }
        saveCart(updated);
    }

    public void removeFromCart(String foodId) {
        updateQuantity(foodId, 0);
    }

    public void clearCart() {
        prefs.edit().remove(cartKey()).apply();
    }

    public void removeOrderedItems(List<OrderItem> orderedItems) {
        Map<String, Integer> orderedQuantities = new HashMap<>();
        for (OrderItem item : orderedItems) {
            orderedQuantities.merge(item.getFoodId(), item.getQuantity(), Integer::sum);
        }
        List<CartItem> remaining = new ArrayList<>();
        for (CartItem item : getCartItems()) {
            int quantity = item.getQuantity()
                    - orderedQuantities.getOrDefault(item.getFood().getId(), 0);
            if (quantity > 0) {
                item.setQuantity(quantity);
                remaining.add(item);
            }
        }
        saveCart(remaining);
    }

    public double getTotalAmount() {
        double total = 0;
        for (CartItem item : getCartItems()) {
            total += item.getTotalPrice();
        }
        return total;
    }

    public int getTotalQuantity() {
        int total = 0;
        for (CartItem item : getCartItems()) {
            total += item.getQuantity();
        }
        return total;
    }

    private void saveCart(List<CartItem> items) {
        prefs.edit().putString(cartKey(), gson.toJson(items)).apply();
    }
}
