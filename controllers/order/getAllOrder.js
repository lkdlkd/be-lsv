
const Order = require('../../models/Order');

// get trạng thái đơn hàng 
async function getAllOrder(req, res) {
const {  category } = req.query;
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
      .populate( 'category');
      
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

// Hàm xóa đơn hàng theo _id
async function deleteOrder(req, res) {
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
