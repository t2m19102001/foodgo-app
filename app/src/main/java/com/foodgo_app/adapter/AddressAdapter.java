package com.foodgo_app.adapter;

import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.google.android.material.button.MaterialButton;
import com.foodgo_app.R;
import com.foodgo_app.model.SavedAddress;

import java.util.ArrayList;
import java.util.List;

public class AddressAdapter extends RecyclerView.Adapter<AddressAdapter.AddressViewHolder> {

    public interface OnAddressActionListener {
        void onSelect(SavedAddress address);
        void onSetDefault(SavedAddress address);
        void onEdit(SavedAddress address);
        void onDelete(SavedAddress address);
    }

    private List<SavedAddress> addresses = new ArrayList<>();
    private final OnAddressActionListener listener;

    public AddressAdapter(OnAddressActionListener listener) {
        this.listener = listener;
    }

    public void setAddresses(List<SavedAddress> newAddresses) {
        this.addresses = newAddresses != null ? newAddresses : new ArrayList<>();
        notifyDataSetChanged();
    }

    @NonNull
    @Override
    public AddressViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_address, parent, false);
        return new AddressViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull AddressViewHolder holder, int position) {
        holder.bind(addresses.get(position), listener);
    }

    @Override
    public int getItemCount() {
        return addresses.size();
    }

    static class AddressViewHolder extends RecyclerView.ViewHolder {
        private final TextView textName;
        private final TextView textDefaultBadge;
        private final TextView textPhone;
        private final TextView textAddress;
        private final TextView textNote;
        private final MaterialButton btnSetDefault;
        private final MaterialButton btnEdit;
        private final MaterialButton btnDelete;

        AddressViewHolder(@NonNull View itemView) {
            super(itemView);
            textName = itemView.findViewById(R.id.text_name);
            textDefaultBadge = itemView.findViewById(R.id.text_default_badge);
            textPhone = itemView.findViewById(R.id.text_phone);
            textAddress = itemView.findViewById(R.id.text_address);
            textNote = itemView.findViewById(R.id.text_note);
            btnSetDefault = itemView.findViewById(R.id.btn_set_default);
            btnEdit = itemView.findViewById(R.id.btn_edit);
            btnDelete = itemView.findViewById(R.id.btn_delete);
        }

        void bind(SavedAddress address, OnAddressActionListener listener) {
            textName.setText(address.getFullName());
            textPhone.setText(address.getPhone());
            textAddress.setText(address.getAddress());

            boolean hasNote = !TextUtils.isEmpty(address.getNote());
            textNote.setText(address.getNote());
            textNote.setVisibility(hasNote ? View.VISIBLE : View.GONE);

            textDefaultBadge.setVisibility(address.isDefault() ? View.VISIBLE : View.GONE);
            btnSetDefault.setVisibility(address.isDefault() ? View.GONE : View.VISIBLE);

            itemView.setOnClickListener(v -> {
                if (listener != null) listener.onSelect(address);
            });
            btnSetDefault.setOnClickListener(v -> {
                if (listener != null) listener.onSetDefault(address);
            });
            btnEdit.setOnClickListener(v -> {
                if (listener != null) listener.onEdit(address);
            });
            btnDelete.setOnClickListener(v -> {
                if (listener != null) listener.onDelete(address);
            });
        }
    }
}
