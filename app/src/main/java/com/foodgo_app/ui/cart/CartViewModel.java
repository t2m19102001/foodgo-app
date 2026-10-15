package com.foodgo_app.ui.cart;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.model.CartItem;
import com.foodgo_app.model.Food;
import com.foodgo_app.repository.CartRepository;

import java.util.List;

public class CartViewModel extends AndroidViewModel {

    private final CartRepository cartRepository;

    private final MutableLiveData<List<CartItem>> cartItems = new MutableLiveData<>();
    private final MutableLiveData<Double> totalAmount = new MutableLiveData<>();

    public CartViewModel(@NonNull Application application) {
        super(application);
        cartRepository = new CartRepository(application);
        reload();
    }

    public LiveData<List<CartItem>> getCartItems() { return cartItems; }
    public LiveData<Double> getTotalAmount() { return totalAmount; }

    public void reload() {
        cartItems.setValue(cartRepository.getCartItems());
        totalAmount.setValue(cartRepository.getTotalAmount());
    }

    public void addItem(Food food) {
        cartRepository.addToCart(food);
        reload();
    }

    public void updateQuantity(String foodId, int quantity) {
        cartRepository.updateQuantity(foodId, quantity);
        reload();
    }

    public void removeItem(String foodId) {
        cartRepository.removeFromCart(foodId);
        reload();
    }

    public void clear() {
        cartRepository.clearCart();
        reload();
    }
}
