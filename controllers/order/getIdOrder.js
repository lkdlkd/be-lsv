const Order = require('../../models/Order');

const jwt = require("jsonwebtoken");


// Lấy đơn hàng theo category và user (dựa trên token)
async function getOrdersByCategoryAndUser(req, res) {
  // Lấy token từ header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Không có token trong header' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, "secretKey");
  } catch (err) {
    return res.status(401).json({ message: 'Token hết hạn hoặc không hợp lệ' });
  }

  // Sử dụng username từ token, bỏ qua giá trị truyền qua query
  const tokenUsername = decoded.username;
  // Lấy category từ query nếu có
  // const { category } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10; // Số đơn mỗi trang
  const skip = (page - 1) * limit;

  // // Nếu category chưa được cung cấp thì báo lỗi (tuỳ theo yêu cầu của bạn)
  // if (!category) {
  //   return res.status(400).json({ message: 'Thiếu thông tin category' });
  // }

  try {
    // Lấy danh sách đơn theo phân trang, lọc theo username từ token và category
    const orders = await Order.find({ username: tokenUsername })
      .sort({ createdAt: -1 }) // Sắp xếp theo createdAt giảm dần (mới nhất lên đầu)
      .skip(skip)
      .limit(limit)
      .populate('username');

      // .populate('username', 'category');

    // Đếm tổng số đơn để tính số trang
    // const totalOrders = await Order.countDocuments({ username: tokenUsername, category });
    const totalOrders = await Order.countDocuments({ username: tokenUsername});

    if (orders.length === 0) {
      return res.status(404).json({ message: 'bạn chưa có đơn hàng nào' });
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

// Lấy đơn hàng có điều kiện tìm kiếm theo từ khóa (chỉ hiển thị đơn của token đó)
async function GetOrderscreach(req, res) {
  // Lấy token từ header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Không có token trong header' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, "secretKey");
  } catch (err) {
    return res.status(401).json({ message: 'Token hết hạn hoặc không hợp lệ' });
  }

  // Sử dụng username từ token
  const tokenUsername = decoded.username;

  const { category, search } = req.query;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  // Bắt đầu xây dựng điều kiện truy vấn với username từ token
  let queryCondition = { username: tokenUsername };

  // Nếu có category, thêm điều kiện lọc theo category
  if (category) {
    queryCondition.category = category;
  }

  // Nếu có từ khóa tìm kiếm, thêm điều kiện tìm kiếm theo Madon hoặc link
  if (search) {
    queryCondition.$or = [
      { Madon: { $regex: search, $options: 'i' } },
      { link: { $regex: search, $options: 'i' } }
    ];
  }

  try {
    const orders = await Order.find(queryCondition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('username');

    const totalOrders = await Order.countDocuments(queryCondition);

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
    res.status(500).json({
      message: 'Có lỗi xảy ra khi lấy đơn hàng',
      error: error.message
    });
  }
}

module.exports = {
  getOrdersByCategoryAndUser,
  GetOrderscreach,
};

// async function GetOrderscreach(req, res) {
//   const { username, category, search } = req.query;
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10; // Số đơn mỗi trang
//   const skip = (page - 1) * limit;

//   if (!username || !category) {
//     return res.status(400).json({ message: 'Thiếu thông tin userId hoặc category' });
//   }

//   // Tạo điều kiện tìm kiếm bổ sung nếu có từ khóa tìm kiếm
//   let searchCondition = {};
//   if (search) {
//     // Tìm kiếm theo mã đơn (Madon) hoặc link, không phân biệt chữ hoa chữ thường
//     searchCondition = {
//       $or: [
//         { Madon: { $regex: search, $options: 'i' } },
//         { link: { $regex: search, $options: 'i' } }
//       ]
//     };
//   }

//   try {
//     // Lấy danh sách đơn theo phân trang, sắp xếp đơn mới nhất lên đầu và tích hợp điều kiện tìm kiếm
//     const orders = await Order.find({ username, category, ...searchCondition })
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit)
//       .populate('username', 'category');

//     // Đếm tổng số đơn để tính số trang
//     const totalOrders = await Order.countDocuments({ username, category, ...searchCondition });

//     if (orders.length === 0) {
//       return res.status(404).json({ message: 'Không tìm thấy đơn hàng' });
//     }

//     res.status(200).json({
//       orders,
//       currentPage: page,
//       totalPages: Math.ceil(totalOrders / limit),
//       totalOrders
//     });
//   } catch (error) {
//     res.status(500).json({ message: 'Có lỗi xảy ra khi lấy đơn hàng', error: error.message });
//   }
// }

