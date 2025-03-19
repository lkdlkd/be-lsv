const Service = require('../../models/Service');
const User = require('../../models/User');

const jwt = require("jsonwebtoken");

// Hàm kiểm tra token và quyền admin
const verifyAdmin = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ success: false, message: 'Không có token trong header' });
    return null;
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    return null;
  }
  try {
    const decoded = jwt.verify(token, "secretKey");
    // Lấy user từ DB dựa trên userId từ decoded token
    const user = await User.findById(decoded.userId);
    if (!user) {
      res.status(404).json({ error: 'Người dùng không tồn tại' });
      return null;
    }

    // So sánh token trong header với token đã lưu của user
    if (user.token !== token) {
      res.status(401).json({ error: 'Token không hợp lệ' });
      return null;
    }

    if (decoded.role !== "admin") {
      res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền sử dụng chức năng này' });
      return null;
    }
    return decoded;
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token hết hạn hoặc không hợp lệ' });
    return null;
  }
};

// Thêm dịch vụ mới (chỉ admin)
exports.addService = async (req, res) => {
  try {
    // Kiểm tra token admin
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    const newService = new Service(req.body);
    await newService.save();
    res.status(201).json({ success: true, message: 'Dịch vụ được thêm thành công', data: newService });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Lỗi khi thêm dịch vụ', error: error.message });
  }
};

// Lấy danh sách dịch vụ (mở)
exports.getServices = async (req, res) => {
  try {
    const services = await Service.find();

    // Giả sử bạn muốn hiển thị các trường: description, Magoi, id, maychu, Linkdv, name, rate, min, max, type, category, iscomment, trangthai
    const formattedServices = services.map(service => ({
      description: service.description,
      Magoi: service.Magoi,
      id: service.id,
      maychu: service.maychu,
      Linkdv: service.Linkdv,
      name: service.name,
      rate: service.rate,
      min: service.min,
      max: service.max,
      type: service.type,
      category: service.category,
      iscomment: service.comment,
      trangthai: service.isActive,
    }));

    res.status(200).json({ success: true, data: formattedServices });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi khi lấy danh sách dịch vụ',
      error: error.message
    });
  }
};

// Cập nhật dịch vụ (chỉ admin)
exports.updateService = async (req, res) => {
  try {
    // Kiểm tra token admin
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    const updatedService = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updatedService) {
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });
    }
    res.status(200).json({ success: true, message: 'Cập nhật dịch vụ thành công', data: updatedService });
  } catch (error) {
    res.status(400).json({ success: false, message: 'Lỗi khi cập nhật dịch vụ', error: error.message });
  }
};

// Xóa dịch vụ (chỉ admin)
exports.deleteService = async (req, res) => {
  try {
    // Kiểm tra token admin
    const decoded = await verifyAdmin(req, res);
    if (!decoded) return;

    const deletedService = await Service.findByIdAndDelete(req.params.id);
    if (!deletedService) {
      return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });
    }
    res.status(200).json({ success: true, message: 'Xóa dịch vụ thành công' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi khi xóa dịch vụ', error: error.message });
  }
};
