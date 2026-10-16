# Gson doc du lieu qua reflection theo ten field, nen R8 doi ten field model se lam JSON parse ra null
-keep class com.foodgo_app.model.** { <fields>; }

# ApiService duoc Retrofit goi qua dynamic proxy, khong co call site tinh de R8 nhin thay
-keep,allowobfuscation,allowshrinking interface com.foodgo_app.api.ApiService

# Giu generic signature cho TypeToken (vi du ArrayList<CartItem> trong gio hang luu o SharedPreferences)
-keepattributes Signature, *Annotation*, EnclosingMethod, InnerClasses
