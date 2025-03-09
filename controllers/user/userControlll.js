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

        // Tạo token cho user mới (bao gồm cả capbac từ schema)
        const token = jwt.sign(
            { userId: user._id, role: user.role, capbac: user.capbac },
            "secretKey",
            { expiresIn: "1d" }
        );
        // Cập nhật token vào user
        user.token = token;
        await user.save();




        const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        const telegramChatId = process.env.TELEGRAM_CHAT_ID;
        if (telegramBotToken && telegramChatId) {

            const telegramMessage = `📌 *Có khách mới được tạo!*\n\n` +
                `👤 *Khách hàng:* ${username}\n` +
                `🔹 *tạo lúc* ${new Date()}\n`;
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


        
        return res.status(201).json({ message: "Đăng ký thành công", userId: user._id, token });
    } catch (error) {
        console.error("Đăng ký lỗi:", error);
        return res.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại." });
    }
};

// Lấy số dư người dùng
exports.getBalance = async (req, res) => {
    const { username } = req.query;
    try {
        const user = await User.findOne({ username }).select("-password");
        if (!user) {
            return res.status(404).json({ error: 'Người dùng không tồn tại' });
        }
        return res.status(200).json(user);
    } catch (error) {
        console.error("Get balance error:", error);
        return res.status(500).json({ error: 'Có lỗi xảy ra. Vui lòng thử lại sau.' });
    }
};

// Lấy danh sách người dùng có phân trang
exports.getUsers = async (req, res) => {
    try {
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

// Cập nhật thông tin người dùng
exports.updateUser = async (req, res) => {
    try {
        const { id } = req.params;
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

// Cộng tiền vào số dư
exports.addBalance = async (req, res) => {
    try {
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

        // res.json({ message: 'Cộng tiền thành công', user: updatedUser });
    } catch (error) {
        console.error("Add balance error:", error);
        return res.status(500).json({ message: 'Lỗi server' });
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
        return res.json({ message: 'User deleted successfully' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};
