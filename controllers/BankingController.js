const Bank = require('../models/Bank');
const User = require("../models/User");
const jwt = require("jsonwebtoken");


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
        res.status(401).json({ error: 'Token không hợp lệ1' });
        return null;
    }

    // Kiểm tra quyền admin
    if (decoded.role !== "admin") {
        res.status(403).json({ error: 'Chỉ admin mới có quyền sử dụng chức năng này' });
        return null;
    }

    return decoded;
};
exports.createBank = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;
        const bank = new Bank(req.body);
        await bank.save();
        res.status(201).json(bank);
        console.log(bank)
    } catch (error) {
        res.status(400).json({ error: error.message });
    }

};

exports.updateBank = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;
        const bank = await Bank.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!bank) return res.status(404).json({ message: 'Bank not found' });
        res.json(bank);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

exports.deleteBank = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;

        const bank = await Bank.findByIdAndDelete(req.params.id);
        if (!bank) return res.status(404).json({ message: 'Bank not found' });
        res.json({ message: 'Bank deleted successfully' });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
exports.getBank = async (req, res) => {
    try {
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


        let banks;
        // Nếu người dùng là admin, hiển thị tất cả các trường
        if (decoded.role === "admin") {
            banks = await Bank.find();
        } else {
            // Ngược lại, ẩn các trường nhạy cảm
            banks = await Bank.find().select("-bank_account -bank_password -token");
        }

        if (!banks || banks.length === 0) {
            return res.status(404).json({ message: 'Bank not found' });
        }
        res.json(banks);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

