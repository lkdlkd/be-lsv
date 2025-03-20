const jwt = require("jsonwebtoken");
const User = require("../../models/User");
const HistoryUser = require('../../models/HistoryUser');
const axios = require('axios');
const crypto = require("crypto");

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

        // Kiểm tra username không chứa ký tự đặc biệt (chỉ cho phép chữ, số và gạch dưới)
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

        // **Tạo API key**
        const apiKey = crypto.randomBytes(32).toString("hex");

        // Tạo người dùng mới
        const user = new User({
            username,
            password,
            role: isAdminExists ? "user" : "admin",
            token: "", // Sẽ cập nhật sau
            apiKey,  // **Lưu API key**
        });

        await user.save();

        // **Tạo token đăng nhập**
        const token = jwt.sign(
            { username: user.username, userId: user._id, role: user.role },
            "secretKey"
        );

        // Cập nhật token vào user
        user.token = token;
        await user.save();

        // **Thông báo qua Telegram**
        const taoluc = new Date();
        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        if (telegramBotToken && telegramChatId) {
            const telegramMessage = `📌 *Có khách mới được tạo!*\n\n` +
                `👤 *Khách hàng:* ${username}\n` +
                `🔹 *Tạo lúc:* ${taoluc.toLocaleString()}\n` +
                `🔑 *API Key:* \`${apiKey}\`\n`;

            try {
                await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                    chat_id: telegramChatId,
                    text: telegramMessage,
                    parse_mode: "Markdown",
                });
                console.log('Thông báo Telegram đã được gửi.');
            } catch (telegramError) {
                console.error('Lỗi gửi thông báo Telegram:', telegramError.message);
            }
        }

        return res.status(201).json({
            message: "Đăng ký thành công",
        });

    } catch (error) {
        console.error("Đăng ký lỗi:", error);
        return res.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại." });
    }
};

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

        // Tìm người dùng theo username
        const user = await User.findOne({ username }).select("-password");
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }

        // So sánh token trong header với token đã lưu của user
        if (user.token !== token) {
            return res.status(401).json({ error: 'Token không hợp lệ' });
        }

        // Kiểm tra xem token có phải của user đang yêu cầu không
        if (decoded.userId !== user._id.toString()) {
            return res.status(403).json({ error: 'Bạn không có quyền xem thông tin người dùng này' });
        }

        // Trả về thông tin user nhưng thay token bằng apiKey
        return res.status(200).json({
            balance: user.balance,
            capbac: user.capbac,
            createdAt: user.createdAt,
            role: user.role,
            status: user.status,
            token: user.apiKey, // Hiển thị API Key thay vì token
            tongnap: user.tongnap,
            tongnapthang: user.tongnapthang,
            updatedAt: user.updatedAt,
            userId: user._id,
            username: user.username,
        });

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
        // Kiểm tra vai trò admin
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền xem danh sách người dùng' });
        }

        // Xử lý phân trang
        let { page, limit, username } = req.query;
        page = parseInt(page) || 1;
        limit = limit === "all" ? null : parseInt(limit) || 10;

        // Nếu có tham số username thì tạo filter tìm kiếm
        const filter = username ? { username: { $regex: username, $options: "i" } } : {};

        // Nếu limit = null, trả về tất cả kết quả theo filter và sắp xếp theo balance giảm dần
        if (!limit) {
            const users = await User.find(filter)
                .sort({ balance: -1 });
            return res.json(users);
        }

        const users = await User.find(filter)
            .sort({ balance: -1 }) // Sắp xếp theo balance từ cao đến thấp
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await User.countDocuments(filter);
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
        const userr = await User.findById(decoded.userId);
        if (!userr) {
            res.status(404).json({ error: 'Người dùng không tồn tại' });
            return null;
        }

        // So sánh token trong header với token đã lưu của user
        if (userr.token !== token) {
            res.status(401).json({ error: 'Token không hợp lệ' });
            return null;
        }
        const { id } = req.params;
        const { amount } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Số tiền không hợp lệ' });
        }

        // Lấy ngày hiện tại
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1; // getMonth trả về 0-11
        const currentYear = currentDate.getFullYear();

        // Tìm người dùng và cập nhật số dư
        let user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }

        const update = {
            $inc: {
                balance: amount,
                tongnap: amount,
                tongnapthang: amount
            },
            $set: { lastDepositMonth: { month: currentMonth, year: currentYear } }
        };

        const updatedUser = await User.findByIdAndUpdate(id, update, { new: true });


        // Lưu lịch sử giao dịch
        const currentBalance = updatedUser.balance;
        const historyDataa = new HistoryUser({
            username: updatedUser.username,
            madon: "null",
            hanhdong: 'Cộng tiền',
            link: "",
            tienhientai: currentBalance,
            tongtien: amount,
            tienconlai: currentBalance, // Sau khi cộng tiền
            createdAt: new Date(),
            mota: `Admin cộng thành công số tiền ${amount}`
        });
        console.log('History:', historyDataa);
        await historyDataa.save();
        const taoluc = new Date();

        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        if (telegramBotToken && telegramChatId) {
            const telegramMessage = `📌 *Cộng tiền!*\n\n` +
                `👤 *Khách hàng:* ${updatedUser.username}\n` +
                `👤 *Cộng tiền:*  Admin đã cộng thành công số tiền ${amount}.\n` +

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
        res.status(200).json({ message: 'Cộng tiền thành công', user: updatedUser });
    } catch (error) {
        console.error("Add balance error:", error);
        return res.status(500).json({ message: 'Lỗi server' });
    }
};
exports.deductBalance = async (req, res) => {
    try {
        // Xác thực token từ header (giả sử định dạng: "Bearer <token>")
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

        const userr = await User.findById(decoded.userId);
        if (!userr) {
            res.status(404).json({ error: 'Người dùng không tồn tại' });
            return null;
        }

        // So sánh token trong header với token đã lưu của user
        if (userr.token !== token) {
            res.status(401).json({ error: 'Token không hợp lệ' });
            return null;
        }
        // Chỉ admin mới có quyền trừ tiền
        if (decoded.role !== "admin") {
            return res.status(403).json({ error: 'Chỉ admin mới có quyền trừ tiền từ số dư' });
        }

        // Lấy thông tin id người dùng từ params và số tiền cần trừ từ body
        const { id } = req.params;
        const { amount } = req.body;

        if (!amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ message: 'Số tiền cần trừ không hợp lệ' });
        }

        // Tìm người dùng theo id
        let user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: 'Người dùng không tồn tại' });
        }

        // Kiểm tra số dư hiện tại có đủ để trừ không
        if (user.balance < amount) {
            return res.status(400).json({ message: 'Số dư không đủ để trừ' });
        }

        // Trừ tiền khỏi số dư
        user.balance -= amount;
        // (Nếu bạn có field nào cập nhật lịch sử trừ tiền tổng hợp thì cập nhật ở đây, ví dụ: user.tongrut = (user.tongrut || 0) + amount;)
        const updatedUser = await user.save();

        // Lưu lịch sử giao dịch (số tiền trừ sẽ lưu dưới dạng giá trị âm)
        const historyData = new HistoryUser({
            username: updatedUser.username,
            madon: "null",
            hanhdong: 'Trừ tiền',
            link: "",
            tienhientai: updatedUser.balance,
            tongtien: amount, // Số tiền đã trừ
            tienconlai: updatedUser.balance, // Sau khi trừ tiền
            createdAt: new Date(),
            mota: `Admin trừ thành công số tiền ${amount}`
        });
        console.log('History:', historyData);
        await historyData.save();

        // Gửi thông báo qua Telegram (nếu cấu hình có đủ)
        const taoluc = new Date();
        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        if (telegramBotToken && telegramChatId) {
            const telegramMessage = `📌 *Trừ tiền!*\n\n` +
                `👤 *Khách hàng:* ${updatedUser.username}\n` +
                `💸 *Số tiền trừ:* Admin đã trừ thành công số tiền ${amount}.\n` +
                `🔹 *Tạo lúc:* ${taoluc.toLocaleString()}\n`;
            try {
                await axios.post(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
                    chat_id: telegramChatId,
                    text: telegramMessage,
                    parse_mode: 'Markdown'
                });
                console.log('Thông báo Telegram đã được gửi.');
            } catch (telegramError) {
                console.error('Lỗi gửi thông báo Telegram:', telegramError.message);
            }
        } else {
            console.log('Thiếu thông tin cấu hình Telegram.');
        }

        return res.status(200).json({ message: 'Trừ tiền thành công', user: updatedUser });
    } catch (error) {
        console.error("Deduct balance error:", error);
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
        const userr = await User.findById(decoded.userId);
        if (!userr) {
            res.status(404).json({ error: 'Người dùng không tồn tại' });
            return null;
        }

        // So sánh token trong header với token đã lưu của user
        if (userr.token !== token) {
            res.status(401).json({ error: 'Token không hợp lệ' });
            return null;
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
        // Lấy token từ header
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

        const userr = await User.findById(decoded.userId);
        if (!userr) {
            return res.status(404).json({ error: "Người dùng không tồn tại" });
        }

        // So sánh token trong header với token đã lưu của user
        if (userr.token !== token) {
            return res.status(401).json({ error: "Token không hợp lệ" });
        }

        // Lấy id của user cần đổi mật khẩu
        const { id } = req.params;
        const { oldPassword, newPassword } = req.body;

        if (!newPassword) {
            return res.status(400).json({ error: "Mật khẩu mới không được để trống" });
        }

        // Kiểm tra quyền hạn
        if (decoded.role !== "admin" && decoded.userId !== id) {
            return res.status(403).json({ error: "Bạn không có quyền đổi mật khẩu cho người dùng này" });
        }

        // Tìm user
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ error: "Người dùng không tồn tại" });
        }

        // Nếu không phải admin, kiểm tra mật khẩu cũ
        if (decoded.role !== "admin") {
            if (!oldPassword) {
                return res.status(400).json({ error: "Vui lòng cung cấp mật khẩu hiện tại" });
            }
            const isMatch = await user.comparePassword(oldPassword);
            if (!isMatch) {
                return res.status(400).json({ error: "Mật khẩu hiện tại không chính xác" });
            }
        }

        // Cập nhật mật khẩu mới
        user.password = newPassword;

        // Tạo token mới
        const newToken = jwt.sign(
            { username: user.username, userId: user._id, role: user.role },
            "secretKey"
        );

        // **Tạo API key mới**
        const newApiKey = crypto.randomBytes(32).toString("hex");

        // Cập nhật thông tin mới vào database
        user.token = newToken;
        user.apiKey = newApiKey;
        await user.save();

        return res.status(200).json({
            message: "Đổi mật khẩu thành công",
            token: newToken
        });
    } catch (error) {
        console.error("Change password error:", error);
        return res.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại sau." });
    }
};