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
// Lấy danh sách dịch vụ (mở)
exports.getServices = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, message: 'Không có token trong header' });
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    }
    const decoded = jwt.verify(token, "secretKey");

    // Lấy user từ DB dựa trên userId từ decoded token
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    // So sánh token trong header với token đã lưu của user
    if (user.token !== token) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    }

    // Nếu user là admin, hiển thị tất cả dịch vụ. Nếu không, chỉ hiển thị những dịch vụ đang hoạt động.
    let services;
    if (user.role === "admin") {
      services = await Service.find();
      return res.status(200).json({ success: true, data: services });

    } else {
      const services = await Service.find();


        // Định dạng dữ liệu trả về
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
    
        return res.status(200).json({ success: true, data: formattedServices });
    }
  } catch (error) {
    return res.status(500).json({
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
