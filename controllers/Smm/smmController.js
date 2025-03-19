const SmmSv = require("../../models/SmmSv");
const jwt = require("jsonwebtoken");
const User = require('../../models/User');

// Middleware kiểm tra token và quyền admin
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
    try {
        const decoded = jwt.verify(token, "secretKey");
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
        if (decoded.role !== "admin") {
            res.status(403).json({ error: 'Chỉ admin mới có quyền sử dụng chức năng này' });
            return null;
        }
        return decoded;
    } catch (err) {
        res.status(401).json({ error: 'Token hết hạn hoặc không hợp lệ' });
        return null;
    }
};

// Thêm mới một đối tác SMM
exports.createPartner = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;

        const newPartner = new SmmSv(req.body);
        await newPartner.save();
        res.status(201).json({ message: "Đã thêm đối tác SMM thành công!", data: newPartner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Lấy danh sách tất cả đối tác SMM
exports.getAllPartners = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;

        const partners = await SmmSv.find();
        res.status(200).json(partners);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Lấy thông tin một đối tác SMM theo ID
exports.getPartnerById = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;

        const partner = await SmmSv.findById(req.params.id);
        if (!partner) {
            return res.status(404).json({ message: "Không tìm thấy đối tác SMM!" });
        }
        res.status(200).json(partner);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Cập nhật thông tin đối tác SMM
exports.updatePartner = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;

        const updatedPartner = await SmmSv.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedPartner) {
            return res.status(404).json({ message: "Không tìm thấy đối tác SMM!" });
        }
        res.status(200).json({ message: "Cập nhật thành công!", data: updatedPartner });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Xóa đối tác SMM
exports.deletePartner = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;

        const deletedPartner = await SmmSv.findByIdAndDelete(req.params.id);
        if (!deletedPartner) {
            return res.status(404).json({ message: "Không tìm thấy đối tác SMM!" });
        }
        res.status(200).json({ message: "Xóa thành công!" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
