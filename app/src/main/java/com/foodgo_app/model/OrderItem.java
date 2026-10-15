package com.foodgo_app.model;

public class OrderItem {
    private String foodId;
    private String name;
    private double price;
    private int quantity;
    private String image;

    public OrderItem() {
    }

    public OrderItem(String foodId, String name, double price, int quantity, String image) {
        this.foodId = foodId;
        this.name = name;
        this.price = price;
        this.quantity = quantity;
        this.image = image;
    }

    public String getFoodId() { return foodId; }
    public String getName() { return name; }
    public double getPrice() { return price; }
    public int getQuantity() { return quantity; }
    public String getImage() { return image; }

    public void setQuantity(int quantity) { this.quantity = quantity; }
}
