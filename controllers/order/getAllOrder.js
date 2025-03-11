const Order = require('../../models/Order');
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
    if (decoded.role !== "admin") {
      res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền thực hiện' });
      return null;
    }
    return decoded;
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token hết hạn hoặc không hợp lệ' });
    return null;
  }
};

// Lấy trạng thái đơn hàng 
async function getAllOrder(req, res) {
  // Kiểm tra token và quyền admin
  const decoded = await verifyAdmin(req, res);
  if (!decoded) return;
  const { category } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10; // Số đơn mỗi trang
  const skip = (page - 1) * limit;

  if (!category) {
    return res.status(400).json({ message: 'Thiếu thông tin userId hoặc category' });
  }

  try {
    // Lấy danh sách đơn theo phân trang và sắp xếp đơn mới nhất lên đầu
    const orders = await Order.find({ category })
      .sort({ createdAt: -1 }) // Sắp xếp theo createdAt giảm dần (mới nhất lên đầu)
      .skip(skip)
      .limit(limit)
      .populate('category');

    // Đếm tổng số đơn để tính số trang
    const totalOrders = await Order.countDocuments({ category });

    if (orders.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }

    res.status(200).json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(totalOrders / limit),
      totalOrders
    });
  } catch (error) {
    res.status(500).json({ message: 'Có lỗi xảy ra khi lấy đơn hàng', error: error.message });
  }
}

// Hàm xóa đơn hàng theo _id (chỉ admin)
async function deleteOrder(req, res) {
  // Kiểm tra token và quyền admin
  const decoded = await verifyAdmin(req, res);
  if (!decoded) return;

  const { orderId } = req.params; // Lấy _id của đơn hàng cần xóa từ URL
  try {
    // Tìm và xóa đơn hàng theo _id
    const order = await Order.findOneAndDelete({ _id: orderId });
    if (!order) {
      return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
    }
    res.status(200).json({ message: 'Xóa đơn hàng thành công', order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Có lỗi xảy ra khi xóa đơn hàng', error: error.message });
  }
}

module.exports = {
  getAllOrder,
  deleteOrder,
};
