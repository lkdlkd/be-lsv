const HistoryUser = require("../../models/HistoryUser");

// Controller: Lấy danh sách history theo username với phân trang
exports.getHistoryByUsername = async (req, res) => {
    try {
        const { username } = req.params;
        // Lấy query params, nếu không truyền thì mặc định trang 1, mỗi trang 10 mục
        let { page = 1, limit = 10 } = req.query;
        page = parseInt(page);
        limit = parseInt(limit);
        
        // Tính số bản ghi cần bỏ qua
        const skip = (page - 1) * limit;
        
        // Lấy dữ liệu với phân trang và sắp xếp theo thời gian giảm dần (mới nhất đứng đầu)
        const history = await HistoryUser.find({ username })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Tính tổng số bản ghi để xác định số trang
        const totalItems = await HistoryUser.countDocuments({ username });
        const totalPages = Math.ceil(totalItems / limit);
        
        res.status(200).json({
            history,
            totalPages,
            currentPage: page,
            totalItems
        });
    } catch (error) {
        res.status(500).json({ message: 'Lỗi server', error });
    }
};
