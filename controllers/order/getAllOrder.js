const Order = require('../../models/Order');
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

const verifyAdmin = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        res.status(401).json({ error: 'Không có token trong header' });
        return null;
    }
    const token = authHeader.split(' ')[1];
    if (!token) {
        res.status(401).json({ error: 'Token không hợp lệ' });
        return null;
    }

    let decoded;
    try {
        decoded = jwt.verify(token, "secretKey");
    } catch (err) {
        res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        return null;
    }

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

    // Kiểm tra quyền admin
    if (decoded.role !== "admin") {
        res.status(403).json({ error: 'Chỉ admin mới có quyền sử dụng chức năng này' });
        return null;
    }

    return decoded;
};

async function getAllOrder(req, res) {
  // Kiểm tra token và quyền admin
  const decoded = await verifyAdmin(req, res);
  if (!decoded) return;

  // Lấy query params: category, search, page, limit
  const { category, search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Thiết lập filter
  let filter = {};
  if (category) {
    filter.category = category;
  }

  if (search) {
    filter.$or = [
      { Madon: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
      { link: { $regex: search, $options: "i" } },
    ];
  }

  try {
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('category');

    const totalOrders = await Order.countDocuments(filter);

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

// Hàm xóa đơn hàng (chỉ admin)
async function deleteOrder(req, res) {
  const decoded = await verifyAdmin(req, res);
  if (!decoded) return;

  const { orderId } = req.params;
  try {
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
