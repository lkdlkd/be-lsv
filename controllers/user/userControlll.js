const jwt = require("jsonwebtoken");
const User = require("../../models/User");


// Đăng nhập
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Sai tên người dùng hoặc mật khẩu" });
    }

    // Tạo token
    const token = jwt.sign({ userId: user._id ,role: user.role}, "secretKey", { expiresIn: "1d" });
    res.status(200).json({ token, role: user.role ,username: user.username });
  } catch (error) {
    res.status(500).json({ error: "Có lỗi xảy ra khi đăng nhập" });
  }
};
// Đăng ký
exports.register = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Kiểm tra nếu người dùng đã tồn tại
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ error: "Tên người dùng đã tồn tại" });
    }

    // Kiểm tra xem đã có admin chưa
    const isAdminExists = await User.findOne({ role: "admin" });

    // Tạo người dùng mới
    const user = new User({
      username,
      password,
      role: isAdminExists ? "user" : "admin",
    });

    // Lưu người dùng và lấy userId (MongoDB tự tạo _id)
    await user.save();

    // Sau khi lưu, MongoDB sẽ tự động tạo _id, bạn có thể lấy _id làm userId
    const userId = user._id;

    // Cập nhật lại userId nếu cần thiết
    user.userId = userId;
    await user.save();

    res.status(201).json({ message: "Đăng ký thành công", userId });
  } catch (error) {
    console.error("Đăng ký lỗi:", error); // Ghi log để kiểm tra lỗi
    res.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại." });
  }
};

exports.getBalance = async (req, res) => {
    const { username } = req.query;
    // console.log("Username tra ve:", username);

    try {
        // Tìm người dùng theo username, loại bỏ mật khẩu
        const user = await User.findOne({ username }).select("-password");
    //   const user = await User.find({ username }).populate('username');

        // Kiểm tra xem người dùng có tồn tại hay không
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        // Trả về tất cả thông tin của người dùng trừ mật khẩu
        res.status(200).json(user);
    } catch (error) {
        console.error(error);  // Ghi lỗi ra console để kiểm tra chi tiết
        res.status(500).json({ error: 'Có lỗi xảy ra. Vui lòng thử lại sau.' });
    }
};


// // Lấy danh sách người dùng có phân trang
exports.getUsers = async (req, res) => {
    try {
        let { page, limit } = req.query;
        if (limit === "all") {
            const users = await User.find(); // Lấy tất cả user
            return res.json(users);
        }
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;

        const users = await User.find()
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await User.countDocuments();

        res.json({
            total,
            page,
            totalPages: Math.ceil(total / limit),
            users
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;
        const updatedUser = await User.findByIdAndUpdate(id, updatedData, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(updatedUser);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.addBalance = async (req, res) => {
    try {
        const { id } = req.params; // Lấy ID của user từ URL
        const { amount } = req.body; // Số tiền cần cộng vào số dư
  
        // Kiểm tra amount có hợp lệ không
        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Số tiền không hợp lệ' });
        }
  
        // Cập nhật số dư và tổng tiền nạp
        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $inc: { balance: amount, tongnap: amount } }, // Cộng tiền vào cả balance và tongnap
            { new: true } // Trả về user sau khi cập nhật
        );
  
        // Kiểm tra user có tồn tại không
        if (!updatedUser) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }
  
        res.json({ message: 'Cộng tiền thành công', user: updatedUser });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Lỗi server' });
    }
  };
  
// Xóa người dùng
exports.deleteUser = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


