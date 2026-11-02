# Gson doc du lieu qua reflection theo ten field, nen R8 doi ten field model se lam JSON parse ra null
# AGP 9 bat android.r8.strictFullModeForKeepRules: -keep class khong con ngam giu
# constructor mac dinh, nen khai bao <init> ro rang cho Gson.
-keep class com.foodgo_app.model.** { <fields>; <init>(...); }

# ApiService duoc Retrofit goi qua dynamic proxy, khong co call site tinh de R8 nhin thay
-keep,allowobfuscation,allowshrinking interface com.foodgo_app.api.ApiService

# Giu generic signature cho TypeToken (vi du ArrayList<CartItem> trong gio hang luu o SharedPreferences)
-keepattributes Signature, *Annotation*, EnclosingMethod, InnerClasses
