const axios = require('axios');
const Service = require('../../models/Service');
const Order = require('../../models/Order');
const HistoryUser = require('../../models/HistoryUser');
const User = require('../../models/User');
// SmmSv là mô hình lưu thông tin cấu hình API (url_api, api_token) trong CSDL
const SmmSv = require("../../models/SmmSv");

async function addOrder(req, res) {
  // Bổ sung biến comments từ req.body
  const { username, link, category, quantity, serviceId, note, comments } = req.body;
  const qty = Number(quantity); // Ép số lượng thành số

  // Chuyển đổi comments về định dạng có "\r\n"
  const formattedComments = comments ? comments.replace(/\r?\n/g, "\r\n") : "";

  try {
    // --- Bước 1: Lấy thông tin dịch vụ từ cơ sở dữ liệu --- 
    const serviceFromDb = await Service.findOne({ serviceId: serviceId });
    if (!serviceFromDb) {
      return res.status(400).json({ message: 'Dịch vụ không tồn tại trong cơ sở dữ liệu' });
    }
    console.log("sv :", serviceFromDb);

    // --- Lấy cấu hình API từ CSDL ---
    const smmSvConfig = await SmmSv.findOne({ name: serviceFromDb.DomainSmm });
    if (!smmSvConfig || !smmSvConfig.url_api || !smmSvConfig.api_token) {
      return res.status(500).json({ message: 'Cấu hình API bên thứ ba chưa được thiết lập' });
    }
    console.log("smm :", smmSvConfig);

    // --- Bước 2: Gửi yêu cầu lấy thông tin dịch vụ từ API bên thứ 3 ---
    const serviceResponse = await axios.post(smmSvConfig.url_api, {
      key: smmSvConfig.api_token,
      action: 'services',  // Lấy thông tin dịch vụ từ API bên thứ 3
    });

    // Kiểm tra nếu dữ liệu dịch vụ trả về không hợp lệ
    if (!serviceResponse.data || !Array.isArray(serviceResponse.data)) {
      return res.status(400).json({ message: 'Không thể lấy dữ liệu dịch vụ từ API bên thứ 3' });
    }
    // Tìm dịch vụ trong danh sách dịch vụ từ API (ép kiểu serviceId thành số)
    const serviceFromApi = serviceResponse.data.find(
      service => service.service === Number(serviceId)
    );

    if (!serviceFromApi) {
      return res.status(400).json({ message: 'Dịch vụ không tồn tại trong hệ thống API bên thứ 3' });
    }

    // Tính tổng chi phí và làm tròn 2 số thập phân
    const totalCost = parseFloat((serviceFromDb.rate * qty).toFixed(2));

    // Kiểm tra nếu giá từ API cao hơn giá trong DB (không cho phép giao dịch)
    if (serviceFromApi.rate > serviceFromDb.rate) {
      return res.status(400).json({ message: 'Chưa chỉnh giá, vui lòng ib admin' });
    }

    // --- Bước 3: Kiểm tra số dư tài khoản của người dùng ---
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }

    // Làm tròn số dư hiện tại của người dùng về 2 số thập phân
    const currentBalance = parseFloat(user.balance.toFixed(2));
    if (currentBalance < totalCost) {
      return res.status(400).json({ message: 'Số dư không đủ để thực hiện giao dịch' });
    }

    // --- Bước 4: Gửi yêu cầu mua dịch vụ qua API bên thứ 3 ---
    const purchasePayload = {
      key: smmSvConfig.api_token,
      action: 'add',
      link,
      quantity: qty,
      service: serviceId,
      comments: formattedComments,  // Gửi comments theo định dạng "cmt\r\ncmt\r\n..."
    };

    const purchaseResponse = await axios.post(smmSvConfig.url_api, purchasePayload);

    if (!purchaseResponse.data || purchaseResponse.data.error) {
      return res.status(400).json({
        message: 'Lỗi khi mua dịch vụ, vui lòng ib admin',
        error: purchaseResponse.data?.error
      });
    }
    tiencu = user.balance;

    // --- Bước 5: Trừ số tiền vào tài khoản người dùng ---
    const newBalance = parseFloat((currentBalance - totalCost).toFixed(2));
    user.balance = newBalance;
    await user.save();

    // Trích xuất orderId từ API response
    const { order } = purchaseResponse.data;
    const createdAt = new Date();

    // --- Bước 6: Tạo mã đơn (Madon)
    const lastOrder = await Order.findOne({}).sort({ Madon: -1 });
    const newMadon = lastOrder && lastOrder.Madon ? Number(lastOrder.Madon) + 1 : 10000;
    
    // --- Bước 7: Tạo đối tượng đơn hàng và lưu vào CSDL ---
    const orderData = new Order({
      Madon: newMadon,
      username,
      orderId: order,
      namesv: serviceFromDb.name,
      category,
      link,
      start: purchaseResponse.data.start_count || 0,
      quantity: qty,
      rate: parseFloat(serviceFromDb.rate.toFixed(2)), // Lưu rate đã làm tròn
      totalCost, // Đã làm tròn
      createdAt,
      status: purchaseResponse.data.status || 'đang chạy',
      note,
      comments: formattedComments,
    });

    // Lưu thông tin lịch sử giao dịch với các giá trị làm tròn
    const HistoryData = new HistoryUser({
      username,
      madon: newMadon,
      hanhdong: 'Tạo đơn hàng',
      link,
      tienhientai: tiencu, // Số dư sau khi trừ tiền
      tongtien: totalCost,   // Tổng chi phí đã làm tròn
      tienconlai: newBalance, // Số dư còn lại (sau khi mua)
      createdAt,
      mota: ' Tăng ' + serviceFromDb.name + ' thành công cho uid ' + link,
    });
    
    console.log('Order:', orderData); // Kiểm tra đối tượng đơn hàng trước khi lưu vào DB
    console.log('History:', HistoryData); // Kiểm tra đối tượng lịch sử trước khi lưu vào DB

    await orderData.save();
    await HistoryData.save();

    console.log('Order saved successfully!');

    res.status(200).json({ message: 'Mua dịch vụ thành công', order: orderData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Không thể thêm đơn hàng', error: error.message });
  }
}

module.exports = { addOrder };
