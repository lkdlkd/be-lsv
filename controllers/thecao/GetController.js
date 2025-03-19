const jwt = require("jsonwebtoken");
const Transaction = require("../../models/TransactionSchema");
const User = require("../../models/User");

exports.getThecao = async (req, res) => {
  try {
    // Lấy token từ header (định dạng: "Bearer <token>")
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Không có token trong header" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token không hợp lệ" });
    }

    // Giải mã token
    let decoded;
    try {
      decoded = jwt.verify(token, "secretKey");

    } catch (err) {
      return res.status(401).json({ error: "Token hết hạn hoặc không hợp lệ" });
    }
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
    // Lấy username từ token
    const username = decoded.username;

    // Truy vấn 20 giao dịch gần nhất của user, chỉ lấy các trường cần thiết
    const transactions = await Transaction.find({ username })
      .select("createdAt type amount serial code real_amount status") // Chỉ lấy các trường này
      .sort({ createdAt: -1 }) // Sắp xếp theo thời gian tạo giảm dần
      .limit(20);

    return res.status(200).json({ transactions });
  } catch (error) {
    console.error("Get balance error:", error);
    return res
      .status(500)
      .json({ error: "Có lỗi xảy ra. Vui lòng thử lại sau." });
  }
};
