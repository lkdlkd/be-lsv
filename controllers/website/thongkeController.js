const User = require("../../models/User");
const Order = require("../../models/Order");
const Deposit = require("../../models/HistoryUser");
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


// Hàm lấy thời điểm bắt đầu của ngày hiện tại
const getStartOfDay = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

// Hàm lấy thời điểm bắt đầu của tháng hiện tại
const getStartOfMonth = () => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
};

exports.getStatistics = async (req, res) => {
    try {
        // Kiểm tra token và quyền admin
        const decoded = await verifyAdmin(req, res);
        if (!decoded) return;
        // Tổng số thành viên
        const tonguser = await User.countDocuments();

        // Tổng số dư của người dùng
        const balanceAgg = await User.aggregate([
            { $group: { _id: null, totalBalance: { $sum: "$balance" } } }
        ]);
        const tongtienweb = balanceAgg[0] ? balanceAgg[0].totalBalance : 0;

        // Tổng số đơn đang chạy (các trạng thái: running, In progress, Processing, Pending)
        const tongdondangchay = await Order.countDocuments({
            status: { $in: ["running", "In progress", "Processing", "Pending"] }
        });

        // Tổng doanh thu từ các đơn hàng đã hoàn thành
        const revenueAgg = await Order.aggregate([
            {
                $match: {
                    status: { $in: ["running", "In progress", "Processing", "Pending", "Completed"] }

                }
            },
            {
                $group: { _id: null, totalRevenue: { $sum: "$totalCost" } }
            }
        ]);
        const tongdoanhthu = revenueAgg[0] ? revenueAgg[0].totalRevenue : 0;

        // Tổng số nạp trong ngày với hành động chứa chữ "nạp tiền"
        const startDay = getStartOfDay();
        const depositTodayAgg = await Deposit.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDay },
                    hanhdong: { $regex: "(nạp tiền|Cộng tiền)", $options: "i" }
                }
            },
            {
                $group: {
                    _id: null,
                    totalDepositToday: { $sum: "$tongtien" }
                }
            }
        ]);
        const tongnapngay = depositTodayAgg[0] ? depositTodayAgg[0].totalDepositToday : 0;
        // Tổng số nạp trong tháng
        const startMonth = getStartOfMonth();
        const depositMonthAgg = await Deposit.aggregate([
            {
                $match: {
                    createdAt: { $gte: startMonth },
                    hanhdong: { $regex: "(nạp tiền|Cộng tiền)", $options: "i" }

                }
            },
            { $group: { _id: null, totalDepositMonth: { $sum: "$tongtien" } } }
        ]);
        const tongnapthang = depositMonthAgg[0] ? depositMonthAgg[0].totalDepositMonth : 0;

        // Tổng đã nạp: Lấy tổng từ trường tongnap của User
        const userDepositAgg = await User.aggregate([
            { $group: { _id: null, totalDeposited: { $sum: "$tongnap" } } }
        ]);
        const tongdanap = userDepositAgg[0] ? userDepositAgg[0].totalDeposited : 0;

        // Trả về thống kê
        res.status(200).json({
            tonguser,
            tongtienweb,
            tongdondangchay,
            tongnapngay,
            tongnapthang,
            tongdanap,
            tongdoanhthu
        });
    } catch (error) {
        console.error("Lỗi thống kê:", error);
        res.status(500).json({ message: "Lỗi server", error: error.message });
    }
};
