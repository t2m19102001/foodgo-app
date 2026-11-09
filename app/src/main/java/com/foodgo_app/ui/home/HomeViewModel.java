package com.foodgo_app.ui.home;

import android.app.Application;

import androidx.annotation.NonNull;
import androidx.lifecycle.AndroidViewModel;
import androidx.lifecycle.LiveData;
import androidx.lifecycle.MutableLiveData;

import com.foodgo_app.util.ApiErrorUtils;
import com.foodgo_app.model.Category;
import com.foodgo_app.model.Food;
import com.foodgo_app.model.RecommendedFood;
import com.foodgo_app.model.response.AiSearchResponse;
import com.foodgo_app.model.response.CategoryListResponse;
import com.foodgo_app.model.response.FoodListResponse;
import com.foodgo_app.model.response.HomeRecommendationsResponse;
import com.foodgo_app.repository.CategoryRepository;
import com.foodgo_app.repository.FoodRepository;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

public class HomeViewModel extends AndroidViewModel {

    private final FoodRepository foodRepository;
    private final CategoryRepository categoryRepository;

    private final MutableLiveData<List<Food>> foodList = new MutableLiveData<>();
    private final MutableLiveData<List<Category>> categoryList = new MutableLiveData<>();
    private final MutableLiveData<Boolean> loading = new MutableLiveData<>(false);
    private final MutableLiveData<String> error = new MutableLiveData<>();
    // AI Recommendation (module 4) - tinh tu lich su mua/danh gia THAT, xem
    // backend/controllers/recommendationController.js
    private final MutableLiveData<List<RecommendedFood>> forYou = new MutableLiveData<>(new ArrayList<>());
    private final MutableLiveData<List<RecommendedFood>> topRated = new MutableLiveData<>(new ArrayList<>());
    // true khi foodList dang la ket qua AI Search (khac voi loc client-side
    // tuc thi khi go tu khoa thuong) - dieu khien banner "Ket qua tim bang AI"
    private final MutableLiveData<Boolean> aiSearchActive = new MutableLiveData<>(false);

    private List<Food> allFoods = new ArrayList<>();
    private String currentCategory = null;
    private String currentKeyword = null;

    public HomeViewModel(@NonNull Application application) {
        super(application);
        foodRepository = new FoodRepository(application);
        categoryRepository = new CategoryRepository(application);
        loadFoods();
        loadCategories();
        loadRecommendations();
    }

    public LiveData<List<Food>> getFoodList() { return foodList; }
    public LiveData<List<Category>> getCategoryList() { return categoryList; }
    public LiveData<Boolean> getLoading() { return loading; }
    public LiveData<String> getError() { return error; }
    public LiveData<List<RecommendedFood>> getForYou() { return forYou; }
    public LiveData<List<RecommendedFood>> getTopRated() { return topRated; }
    public LiveData<Boolean> getAiSearchActive() { return aiSearchActive; }

    // Xoa loi sau khi da hien Toast de khong hien lai khi xoay man hinh
    public void clearError() { error.setValue(null); }

    public void loadFoods() {
        loading.setValue(true);
        foodRepository.getFoodList().enqueue(new Callback<FoodListResponse>() {
            @Override
            public void onResponse(@NonNull Call<FoodListResponse> call, @NonNull Response<FoodListResponse> response) {
                loading.setValue(false);
                FoodListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    allFoods = body.getFoods() != null ? body.getFoods() : new ArrayList<>();
                    applyFilter();
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải danh sách món ăn"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<FoodListResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void loadCategories() {
        categoryRepository.getCategoryList().enqueue(new Callback<CategoryListResponse>() {
            @Override
            public void onResponse(@NonNull Call<CategoryListResponse> call, @NonNull Response<CategoryListResponse> response) {
                CategoryListResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    categoryList.setValue(body.getCategories() != null ? body.getCategories() : new ArrayList<>());
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tải danh mục"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<CategoryListResponse> call, @NonNull Throwable t) {
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    public void filterByCategory(String category) {
        aiSearchActive.setValue(false);
        currentCategory = category;
        applyFilter();
    }

    public void search(String keyword) {
        aiSearchActive.setValue(false);
        currentKeyword = keyword;
        applyFilter();
    }

    public void loadRecommendations() {
        foodRepository.getHomeRecommendations().enqueue(new Callback<HomeRecommendationsResponse>() {
            @Override
            public void onResponse(@NonNull Call<HomeRecommendationsResponse> call, @NonNull Response<HomeRecommendationsResponse> response) {
                HomeRecommendationsResponse body = response.body();
                // Khu vuc goi y khong phai tinh nang chinh - loi o day khong can
                // bao Toast lam phien nguoi dung, chi don gian la an khu vuc di.
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    forYou.setValue(body.getForYou() != null ? body.getForYou() : new ArrayList<>());
                    topRated.setValue(body.getTopRated() != null ? body.getTopRated() : new ArrayList<>());
                }
            }

            @Override
            public void onFailure(@NonNull Call<HomeRecommendationsResponse> call, @NonNull Throwable t) {
                // bo qua - xem ly do o onResponse
            }
        });
    }

    // Goi khi khach bam nut tim kiem (IME action) tren o tim kiem, khac voi
    // search() la loc client-side tuc thi khi dang go.
    public void aiSearch(String query) {
        if (query == null || query.trim().isEmpty()) return;
        loading.setValue(true);
        foodRepository.aiSearchFood(query.trim()).enqueue(new Callback<AiSearchResponse>() {
            @Override
            public void onResponse(@NonNull Call<AiSearchResponse> call, @NonNull Response<AiSearchResponse> response) {
                loading.setValue(false);
                AiSearchResponse body = response.body();
                if (response.isSuccessful() && body != null && body.isSuccess()) {
                    aiSearchActive.setValue(true);
                    foodList.setValue(body.getFoods() != null ? body.getFoods() : new ArrayList<>());
                    if (body.getUnsupported() != null && !body.getUnsupported().isEmpty()) {
                        error.setValue(describeUnsupported(body.getUnsupported()));
                    }
                } else {
                    error.setValue(body != null ? body.getMessage() : ApiErrorUtils.getMessage(response, "Không thể tìm kiếm bằng AI"));
                }
            }

            @Override
            public void onFailure(@NonNull Call<AiSearchResponse> call, @NonNull Throwable t) {
                loading.setValue(false);
                error.setValue("Không thể kết nối tới server: " + t.getMessage());
            }
        });
    }

    // Giai thich MINH BACH cho khach cac tieu chi FoodGo CHUA ho tro (xem
    // backend/util/searchIntent.js) - khong am tham bo qua.
    private static String describeUnsupported(List<String> codes) {
        StringBuilder sb = new StringBuilder("FoodGo chưa hỗ trợ: ");
        for (int i = 0; i < codes.size(); i++) {
            if (i > 0) sb.append(", ");
            switch (codes.get(i)) {
                case "promotion": sb.append("chương trình giảm giá (hiện chưa có)"); break;
                case "distance": sb.append("lọc theo khoảng cách"); break;
                case "openStatus": sb.append("giờ mở/đóng cửa (FoodGo luôn nhận đơn)"); break;
                case "deliveryTime": sb.append("lọc theo thời gian giao hàng cụ thể"); break;
                case "groupSize": sb.append("lọc theo số người ăn"); break;
                default: sb.append(codes.get(i));
            }
        }
        return sb.toString();
    }

    private void applyFilter() {
        List<Food> result = new ArrayList<>();
        for (Food food : allFoods) {
            boolean matchCategory = currentCategory == null || currentCategory.isEmpty()
                    || currentCategory.equalsIgnoreCase(food.getCategory());
            boolean matchKeyword = currentKeyword == null || currentKeyword.trim().isEmpty()
                    || (food.getName() != null
                        && food.getName().toLowerCase(Locale.getDefault())
                            .contains(currentKeyword.trim().toLowerCase(Locale.getDefault())));
            if (matchCategory && matchKeyword) {
                result.add(food);
            }
        }
        foodList.setValue(result);
    }
}
