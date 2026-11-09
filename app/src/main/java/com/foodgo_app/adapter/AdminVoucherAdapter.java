package com.foodgo_app.adapter;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.recyclerview.widget.RecyclerView;

import com.foodgo_app.R;
import com.foodgo_app.model.Voucher;
import com.foodgo_app.util.CurrencyUtils;

import java.util.ArrayList;
import java.util.List;

public class AdminVoucherAdapter extends RecyclerView.Adapter<AdminVoucherAdapter.ViewHolder> {

    public interface OnVoucherActionListener {
        void onEdit(Voucher voucher);
        void onDelete(Voucher voucher);
    }

    private List<Voucher> vouchers = new ArrayList<>();
    private final OnVoucherActionListener listener;

    public AdminVoucherAdapter(OnVoucherActionListener listener) {
        this.listener = listener;
    }

    public void setVouchers(List<Voucher> newVouchers) {
        this.vouchers = newVouchers != null ? newVouchers : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_admin_voucher, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        holder.bind(vouchers.get(position), listener);
    }

    @Override
    public int getItemCount() {
        return vouchers.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        private final TextView textCode;
        private final TextView textStatus;
        private final TextView textDescription;
        private final TextView textDiscount;
        private final TextView textUsage;
        private final View btnEdit;
        private final View btnDelete;

        ViewHolder(@NonNull View itemView) {
            super(itemView);
            textCode = itemView.findViewById(R.id.text_voucher_code);
            textStatus = itemView.findViewById(R.id.text_voucher_status);
            textDescription = itemView.findViewById(R.id.text_voucher_description);
            textDiscount = itemView.findViewById(R.id.text_voucher_discount);
            textUsage = itemView.findViewById(R.id.text_voucher_usage);
            btnEdit = itemView.findViewById(R.id.btn_edit);
            btnDelete = itemView.findViewById(R.id.btn_delete);
        }

        void bind(Voucher voucher, OnVoucherActionListener listener) {
            textCode.setText(voucher.getCode());

            boolean active = voucher.isActive();
            textStatus.setText(active ? "Đang hoạt động" : "Đã khóa");
            textStatus.setTextColor(ContextCompat.getColor(itemView.getContext(),
                    active ? R.color.colorPrimary : R.color.error));

            String description = voucher.getDescription();
            boolean hasDescription = description != null && !description.trim().isEmpty();
            textDescription.setText(description);
            textDescription.setVisibility(hasDescription ? View.VISIBLE : View.GONE);

            StringBuilder discount = new StringBuilder();
            if (voucher.isPercent()) {
                discount.append("Giảm ").append(voucher.getDiscountValue()).append("%");
                if (voucher.getMaxDiscountAmount() != null) {
                    discount.append(" (tối đa ").append(CurrencyUtils.formatVnd(voucher.getMaxDiscountAmount())).append(")");
                }
            } else {
                discount.append("Giảm ").append(CurrencyUtils.formatVnd(voucher.getDiscountValue()));
            }
            if (voucher.getMinOrderValue() > 0) {
                discount.append(" · Đơn tối thiểu ").append(CurrencyUtils.formatVnd(voucher.getMinOrderValue()));
            }
            textDiscount.setText(discount.toString());

            Integer usageLimit = voucher.getUsageLimit();
            boolean hasUsageLimit = usageLimit != null;
            textUsage.setText("Đã dùng: " + (voucher.getUsedCount() != null ? voucher.getUsedCount() : 0)
                    + "/" + (hasUsageLimit ? usageLimit : "∞"));
            textUsage.setVisibility(View.VISIBLE);

            btnEdit.setOnClickListener(v -> {
                if (listener != null) listener.onEdit(voucher);
            });
            btnDelete.setOnClickListener(v -> {
                if (listener != null) listener.onDelete(voucher);
            });
        }
    }
}
