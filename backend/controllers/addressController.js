import addressModel from "../models/addressModel.js";

const validateFields = ({ fullName, phone, address }) => {
  if (![fullName, phone, address].every((value) => typeof value === "string" && value.trim().length > 0)) {
    return "Thiếu thông tin địa chỉ";
  }
  if (fullName.length > 100 || phone.length > 30 || address.length > 300) {
    return "Thông tin địa chỉ quá dài";
  }
  return null;
};

const unsetOtherDefaults = (userId, excludeId) =>
  addressModel.updateMany({ userId, _id: { $ne: excludeId } }, { $set: { isDefault: false } });

export const getMyAddresses = async (req, res) => {
  try {
    const addresses = await addressModel
      .find({ userId: req.userId })
      .sort({ isDefault: -1, createdAt: -1 });
    res.json({ success: true, addresses });
  } catch (error) {
    console.error("Get my addresses error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lấy danh sách địa chỉ" });
  }
};

export const addAddress = async (req, res) => {
  try {
    const { fullName, phone, address, note } = req.body || {};
    const validationError = validateFields({ fullName, phone, address });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    if ((note || "").length > 500) {
      return res.status(400).json({ success: false, message: "Ghi chú quá dài" });
    }

    const existingCount = await addressModel.countDocuments({ userId: req.userId });
    const isDefault = existingCount === 0 || req.body?.isDefault === true;
    if (isDefault && existingCount > 0) {
      await unsetOtherDefaults(req.userId);
    }

    const created = await addressModel.create({
      userId: req.userId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      note: note || "",
      isDefault,
    });

    res.status(201).json({ success: true, message: "Đã lưu địa chỉ", address: created });
  } catch (error) {
    console.error("Add address error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi lưu địa chỉ" });
  }
};

export const updateAddress = async (req, res) => {
  try {
    const address = await addressModel.findById(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, message: "Không tìm thấy địa chỉ" });
    }
    if (address.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền sửa địa chỉ này" });
    }

    const { fullName, phone, address: addressText, note } = req.body || {};
    const validationError = validateFields({ fullName, phone, address: addressText });
    if (validationError) {
      return res.status(400).json({ success: false, message: validationError });
    }
    if ((note || "").length > 500) {
      return res.status(400).json({ success: false, message: "Ghi chú quá dài" });
    }

    address.fullName = fullName.trim();
    address.phone = phone.trim();
    address.address = addressText.trim();
    address.note = note || "";
    await address.save();

    res.json({ success: true, message: "Cập nhật địa chỉ thành công", address });
  } catch (error) {
    console.error("Update address error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi cập nhật địa chỉ" });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const address = await addressModel.findById(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, message: "Không tìm thấy địa chỉ" });
    }
    if (address.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền sửa địa chỉ này" });
    }

    await unsetOtherDefaults(req.userId, address._id);
    address.isDefault = true;
    await address.save();

    res.json({ success: true, message: "Đã đặt làm địa chỉ mặc định", address });
  } catch (error) {
    console.error("Set default address error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi đặt địa chỉ mặc định" });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const address = await addressModel.findById(req.params.id);
    if (!address) {
      return res.status(404).json({ success: false, message: "Không tìm thấy địa chỉ" });
    }
    if (address.userId.toString() !== req.userId) {
      return res.status(403).json({ success: false, message: "Không có quyền xóa địa chỉ này" });
    }

    await addressModel.findByIdAndDelete(address._id);

    // Xoa dia chi mac dinh ma van con dia chi khac -> tu dong dua 1 dia chi len lam mac dinh
    if (address.isDefault) {
      const latestRemaining = await addressModel
        .findOne({ userId: req.userId })
        .sort({ createdAt: -1 });
      if (latestRemaining) {
        latestRemaining.isDefault = true;
        await latestRemaining.save();
      }
    }

    res.json({ success: true, message: "Đã xóa địa chỉ" });
  } catch (error) {
    console.error("Delete address error:", error);
    res.status(500).json({ success: false, message: "Lỗi khi xóa địa chỉ" });
  }
};
