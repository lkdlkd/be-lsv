const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const HistoryUser = require('../../models/HistoryUser');
const axios = require('axios');

// Đăng nhập
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ error: "Sai tên người dùng hoặc mật khẩu" });
        }
        // Trả về token đã lưu trong user (hoặc tạo token mới nếu cần)
        return res.status(200).json({ token: user.token, role: user.role, username: user.username });
    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ error: "Có lỗi xảy ra khi đăng nhập" });
    }
};

// Đăng ký
exports.register = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Kiểm tra username và password không được ngắn hơn 6 ký tự
        if (username.length < 6) {
            return res.status(400).json({ error: "Tên người dùng phải có ít nhất 6 ký tự" });
        }
        if (password.length < 6) {
            return res.status(400).json({ error: "Mật khẩu phải có ít nhất 6 ký tự" });
        }

        // Kiểm tra username không chứa ký tự đặc biệt (cho phép chữ cái, số và dấu gạch dưới)
        const usernameRegex = /^[a-zA-Z0-9_]+$/;
        if (!usernameRegex.test(username)) {
            return res.status(400).json({ error: "Tên người dùng không được chứa ký tự đặc biệt" });
        }

        // Kiểm tra username phải chứa ít nhất một ký tự chữ
        const containsLetterRegex = /[a-zA-Z]/;
        if (!containsLetterRegex.test(username)) {
            return res.status(400).json({ error: "Tên người dùng phải chứa ít nhất một ký tự chữ" });
        }

        // Kiểm tra nếu người dùng đã tồn tại
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.status(400).json({ error: "Tên người dùng đã tồn tại" });
        }

        // Kiểm tra xem đã có admin chưa
        const isAdminExists = await User.findOne({ role: "admin" });

        // Tạo người dùng mới, không cần truyền capbac vì schema đã có default
        const user = new User({
            username,
            password,
            role: isAdminExists ? "user" : "admin",
            token: "", // Tạm thời để rỗng, sẽ cập nhật sau khi tạo token
        });
        await user.save();

        // Tạo token cho user mới (không hết hạn)
        const token = jwt.sign(
            { username: user.username, userId: user._id, role: user.role  },
            "secretKey"
            // Không sử dụng expiresIn, token sẽ không hết hạn
        );
        // Cập nhật token vào user
        user.token = token;
        await user.save();

        const taoluc = new Date();
        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        if (telegramBotToken && telegramChatId) {
            const telegramMessage = `📌 *Có khách mới được tạo!*\n\n` +
                `👤 *Khách hàng:* ${username}\n` +
                `🔹 *Tạo lúc:* ${taoluc.toLocaleString()}\n`;
            try {
                await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                    chat_id: telegramChatId,
                    text: telegramMessage,
                });
                console.log('Thông báo Telegram đã được gửi.');
            } catch (telegramError) {
                console.error('Lỗi gửi thông báo Telegram:', telegramError.message);
            }
        } else {
            console.log('Thiếu thông tin cấu hình Telegram.');
        }
        return res.status(201).json({ message: "Đăng ký thành công" });
    } catch (error) {
        console.error("Đăng ký lỗi:", error);
        return res.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại." });
    }
};


// Lấy số dư người dùng
exports.getBalance = async (req, res) => {
    const { username } = req.query;
    try {
        // Lấy token từ header (giả sử định dạng: "Bearer <token>")
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Không có token trong header' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token không hợp lệ' });
        }

        // Giải mã token
        let decoded;
        try {
            decoded = jwt.verify(token, "secretKey");
        } catch (err) {
            return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        }

        // Tìm người dùng theo username (hoặc có thể tìm theo id từ token)
        const user = await User.findOne({ username }).select("-password");
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        // Kiểm tra xem token có phải của user đang yêu cầu không
        if (decoded.userId !== user._id.toString()) {
            return res.status(403).json({ error: 'Bạn không có quyền xem thông tin người dùng này' });
        }

        return res.status(200).json(user);
    } catch (error) {
        console.error("Get balance error:", error);
        return res.status(500).json({ error: 'Có lỗi xảy ra. Vui lòng thử lại sau.' });
    }
};

// Cập nhật thông tin người dùng (chỉ admin hoặc chính chủ mới có thể sửa)
exports.updateUser = async (req, res) => {
    try {
        // Lấy token từ header (giả sử định dạng: "Bearer <token>")
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Không có token trong header' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token không hợp lệ' });
        }

        // Giải mã token
        let decoded;
        try {
            decoded = jwt.verify(token, "secretKey");
        } catch (err) {
            return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        }

        const { id } = req.params;

        // Cho phép cập nhật nếu là admin hoặc chính chủ tài khoản (so sánh decoded.userId với id)
        if (decoded.role !== "admin" && decoded.userId !== id) {
            return res.status(403).json({ error: 'Bạn không có quyền sửa thông tin người dùng này' });
        }

        const updatedData = req.body;
        const updatedUser = await User.findByIdAndUpdate(id, updatedData, { new: true });
        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json(updatedUser);
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};


// Lấy danh sách người dùng có phân trang (chỉ admin mới có quyền truy cập)
exports.getUsers = async (req, res) => {
    try {
        // Lấy token từ header (giả sử định dạng: "Bearer <token>")
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Không có token trong header' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token không hợp lệ' });
        }

        // Giải mã token
        let decoded;
        try {
            decoded = jwt.verify(token, "secretKey");
        } catch (err) {
            return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        }

        // Kiểm tra vai trò admin
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền xem danh sách người dùng' });
        }

        // Xử lý phân trang
        let { page, limit } = req.query;
        if (limit === "all") {
            const users = await User.find();
            return res.json(users);
        }
        page = parseInt(page) || 1;
        limit = parseInt(limit) || 10;

        const users = await User.find()
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await User.countDocuments();
        return res.json({
            total,
            page,
            totalPages: Math.ceil(total / limit),
            users,
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};




// Cộng tiền vào số dư (chỉ admin mới có quyền)
exports.addBalance = async (req, res) => {
    try {
        // Xác thực token từ header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Không có token trong header' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token không hợp lệ' });
        }

        // Giải mã token
        let decoded;
        try {
            decoded = jwt.verify(token, "secretKey");
        } catch (err) {
            return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        }

        // Chỉ admin mới có quyền cộng tiền
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền cộng tiền vào số dư' });
        }

        const { id } = req.params;
        const { amount } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Số tiền không hợp lệ' });
        }

        const updatedUser = await User.findByIdAndUpdate(
            id,
            { $inc: { balance: amount, tongnap: amount } },
            { new: true }
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }

        // Lưu lịch sử giao dịch
        const currentBalance = updatedUser.balance;
        const historyDataa = new HistoryUser({
            username: updatedUser.username,
            madon: "null",
            hanhdong: 'Cộng tiền',
            link: "",
            tienhientai: currentBalance,
            tongtien: amount,
            tienconlai: currentBalance + amount,
            createdAt: new Date(),
            mota: 'Cộng thành công số tiền ' + amount,
        });
        console.log('History:', historyDataa);
        await historyDataa.save();

        res.status(200).json({ message: 'Cộng tiền thành công', user: updatedUser });
    } catch (error) {
        console.error("Add balance error:", error);
        return res.status(500).json({ message: 'Lỗi server' });
    }
};

// Xóa người dùng (chỉ admin mới có quyền)
exports.deleteUser = async (req, res) => {
    try {
        // Xác thực token từ header
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Không có token trong header' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token không hợp lệ' });
        }

        // Giải mã token
        let decoded;
        try {
            decoded = jwt.verify(token, "secretKey");
        } catch (err) {
            return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        }

        // Chỉ admin mới có quyền xóa user
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền xóa người dùng' });
        }

        const { id } = req.params;
        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found' });
        }
        return res.json({ message: 'User deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

// Đổi mật khẩu (chỉ admin hoặc chính chủ tài khoản mới có thể đổi mật khẩu)
exports.changePassword = async (req, res) => {
    try {
        // Lấy token từ header (giả sử định dạng: "Bearer <token>")
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return res.status(401).json({ error: 'Không có token trong header' });
        }
        const token = authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Token không hợp lệ' });
        }

        // Giải mã token
        let decoded;
        try {
            decoded = jwt.verify(token, "secretKey");
        } catch (err) {
            return res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        }

        // Lấy id của user cần đổi mật khẩu (thường truyền qua params)
        const { id } = req.params;
        // Lấy mật khẩu hiện tại (oldPassword) và mật khẩu mới (newPassword) từ body
        const { oldPassword, newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: 'Mật khẩu mới không được để trống' });
        }

        // Chỉ admin hoặc chính chủ mới được phép đổi mật khẩu
        if (decoded.role !== "admin" && decoded.userId !== id) {
            return res.status(403).json({ error: 'Bạn không có quyền đổi mật khẩu cho người dùng này' });
        }

        // Tìm user theo id
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        // Nếu không phải admin, cần xác thực mật khẩu cũ
        if (decoded.role !== "admin") {
            if (!oldPassword) {
                return res.status(400).json({ error: 'Vui lòng cung cấp mật khẩu hiện tại' });
            }
            const isMatch = await user.comparePassword(oldPassword);
            if (!isMatch) {
                return res.status(400).json({ error: 'Mật khẩu hiện tại không chính xác' });
            }
        }

        // Cập nhật mật khẩu mới (đảm bảo rằng schema của User sẽ hash mật khẩu khi lưu)
        user.password = newPassword;
        await user.save();

        return res.status(200).json({ message: 'Đổi mật khẩu thành công' });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại sau." });
    }
};
