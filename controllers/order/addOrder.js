const axios = require('axios');
const jwt = require("jsonwebtoken");
const Service = require('../../models/Service');
const Order = require('../../models/Order');
const HistoryUser = require('../../models/HistoryUser');
const User = require('../../models/User');
const SmmSv = require("../../models/SmmSv");

async function addOrder(req, res) {
  // Kiểm tra token từ header
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Không có token trong header' });
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token không hợp lệ' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, "secretKey");
  } catch (err) {
    return res.status(401).json({ message: 'Token hết hạn hoặc không hợp lệ' });
  }
  
  // So sánh username trong token và trong body
  // const tokenUsername = decoded.username;
  const { username, link, category, quantity, magoi, note, comments } = req.body;
  // if (username !== tokenUsername) {
  //   return res.status(403).json({ message: 'Bạn không có quyền thực hiện hành động này' });
  // }

  const qty = Number(quantity);
  const formattedComments = comments ? comments.replace(/\r?\n/g, "\r\n") : "";

  try {
    // --- Bước 1: Lấy thông tin dịch vụ từ CSDL ---
    const serviceFromDb = await Service.findOne({ Magoi: magoi });
    if (!serviceFromDb) {
      return res.status(400).json({ message: 'Dịch vụ không tồn tại' });
    }
    console.log("sv :", serviceFromDb);

    // --- Lấy cấu hình API từ CSDL ---
    const smmSvConfig = await SmmSv.findOne({ name: serviceFromDb.DomainSmm });
    if (!smmSvConfig || !smmSvConfig.url_api || !smmSvConfig.api_token) {
      return res.status(500).json({ message: 'Lỗi khi mua dịch vụ, vui lòng ib admin' });
    }
    console.log("smm :", smmSvConfig);

    // --- Bước 2: Gửi yêu cầu lấy thông tin dịch vụ từ API bên thứ 3 ---
    const serviceResponse = await axios.post(smmSvConfig.url_api, {
      key: smmSvConfig.api_token,
      action: 'services',
    });

    if (!serviceResponse.data || !Array.isArray(serviceResponse.data)) {
      return res.status(400).json({ message: 'Không thể lấy dữ liệu dịch vụ' });
    }
    const serviceFromApi = serviceResponse.data.find(
      service => service.service === Number(serviceFromDb.serviceId)
    );
    if (!serviceFromApi) {
      return res.status(400).json({ message: 'Dịch vụ không tồn tại' });
    }

    // Tính tổng chi phí và làm tròn 2 số thập phân
    const totalCost = parseFloat((serviceFromDb.rate * qty).toFixed(2));

    if (serviceFromApi.rate > serviceFromDb.rate) {
      return res.status(400).json({ message: 'Lỗi khi mua dịch vụ, vui lòng ib admin' });
    }

    // --- Bước 3: Kiểm tra số dư tài khoản của người dùng ---
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Người dùng không tồn tại' });
    }
    if (qty < serviceFromDb.min) {
      return res.status(400).json({ message: 'Số lượng vượt quá giới hạn' });
    }
    if (qty > serviceFromDb.max) {
      return res.status(400).json({ message: 'Số lượng vượt quá giới hạn' });
    }
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
      service: serviceFromDb.serviceId,
      comments: formattedComments,
    };

    const purchaseResponse = await axios.post(smmSvConfig.url_api, purchasePayload);
    if (!purchaseResponse.data || purchaseResponse.data.error) {
      return res.status(400).json({
        message: 'Lỗi khi mua dịch vụ, vui lòng ib admin',
        error: purchaseResponse.data?.error
      });
    }
    const tiencu = user.balance;

    // --- Bước 5: Trừ số tiền vào tài khoản người dùng ---
    const newBalance = parseFloat((currentBalance - totalCost).toFixed(2));
    user.balance = newBalance;
    await user.save();

    // --- Bước 6: Tạo mã đơn (Madon) ---
    const lastOrder = await Order.findOne({}).sort({ Madon: -1 });
    const newMadon = lastOrder && lastOrder.Madon ? Number(lastOrder.Madon) + 1 : 10000;

    // --- Bước 7: Tạo đối tượng đơn hàng và lưu vào CSDL ---
    const createdAt = new Date();
    const orderData = new Order({
      Madon: newMadon,
      username,
      SvID : serviceFromDb.serviceId,
      orderId: purchaseResponse.data.order,
      namesv: serviceFromDb.maychu +" "+ serviceFromDb.name,
      category,
      link,
      start: purchaseResponse.data.start_count || 0,
      quantity: qty,
      rate: parseFloat(serviceFromDb.rate.toFixed(2)),
      totalCost,
      createdAt,
      status: purchaseResponse.data.status || 'Pending',
      note,
      comments: formattedComments,
    });

    const HistoryData = new HistoryUser({
      username,
      madon: newMadon,
      hanhdong: 'Tạo đơn hàng',
      link,
      tienhientai: tiencu,
      tongtien: totalCost,
      tienconlai: newBalance,
      createdAt,
      mota: ' Tăng '+serviceFromDb.maychu +" "+ serviceFromDb.name + ' thành công cho uid ' + link,
    });

    console.log('Order:', orderData);
    console.log('History:', HistoryData);

    await orderData.save();
    await HistoryData.save();

    console.log('Order saved successfully!');

    // --- Bước 8: Gửi thông báo về Telegram ---
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
    if (telegramBotToken && telegramChatId) {
      const telegramMessage = `📌 *Đơn hàng mới đã được tạo!*\n\n` +
        `👤 *Khách hàng:* ${username}\n` +
        `🔹 *Dịch vụ:* ${serviceFromDb.name}\n` +
        `🔗 *Link:* ${link}\n` +
        `📌 *Số lượng:* ${qty}\n` +
        `💰 *TIền cũ:* ${tiencu.toLocaleString()} VNĐ\n` +
        `💰 *Tổng tiền:* ${totalCost.toLocaleString()} VNĐ\n` +
        `💰 *TIền còn lại:* ${newBalance.toLocaleString()} VNĐ\n` +
        `🆔 *Mã đơn:* ${newMadon}\n` +
        `📆 *Ngày tạo:* ${createdAt.toLocaleString()}\n` +
        `📝 *Ghi chú:* ${note || 'Không có'}`;

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

    res.status(200).json({ message: 'Mua dịch vụ thành công', order: orderData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Không thể thêm đơn hàng', error: error.message });
  }
}

module.exports = { addOrder };
