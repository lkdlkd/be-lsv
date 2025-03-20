const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const axios = require("axios");
const Transaction = require("../models/TransactionSchema");
const User = require("../models/User");

const FormData = require("form-data");

// Controller tạo transaction
exports.createTransaction = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "Không có token trong header" });
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "Token không hợp lệ" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, "secretKey");
    } catch (err) {
      return res.status(401).json({ error: "Token hết hạn hoặc không hợp lệ" });
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

    const { card_type, card_value, card_seri, card_code } = req.body;
    if (!card_type || !card_value || !card_seri || !card_code) {
      return res.status(400).json({ error: "Missing required card information" });
    }

    // Lấy request_id tăng dần
    const lastTransaction = await Transaction.findOne().sort({ request_id: -1 });


    let request_id = 11; // Mặc định request_id là 1 nếu không có giao dịch trước đó
    if (lastTransaction && typeof lastTransaction.request_id === 'number') {
      request_id = lastTransaction.request_id + 1;
    }

    let trans_id = 1; // Mặc định request_id là 1 nếu không có giao dịch trước đó
    if (lastTransaction && typeof lastTransaction.tran_id === 'number') {
      trans_id = lastTransaction.tran_id + 1;
    }
    const partner_id = process.env.PARTNER_ID || "your_partner_id";
    const partner_key = process.env.PARTNER_KEY || "your_partner_key";

    const sign = crypto
      .createHash("md5")
      .update(partner_key + card_code + card_seri)
      .digest("hex");

    const command = "charging";
    // Tạo form-data để gửi đến API đối tác
    const formdata = new FormData();
    formdata.append("telco", card_type);
    formdata.append("code", card_code);
    formdata.append("serial", card_seri);
    formdata.append("amount", card_value);
    formdata.append("request_id", request_id);
    formdata.append("partner_id", partner_id);
    formdata.append("sign", sign);
    formdata.append("command", command);

    // Gửi yêu cầu lên API đối tác
    const response = await axios.post(process.env.API_URLCARD, formdata, {
      headers: {
        ...formdata.getHeaders(),
      },
    });
    const percent_card = Number(process.env.PERCENT_CARD);
    if (response.data.status === 3) {
      return res.status(500).json({ error: "Thẻ lỗi, kiểm tra lại thẻ" });

    }
    const chietkhau = card_value - (card_value * percent_card / 100);

    // Tạo bản ghi Transaction mới với request_id tăng dần
    const newTransaction = await Transaction.create({
      code: card_code,
      username: decoded.username,
      type: card_type,
      amount: card_value,
      serial: card_seri,
      real_amount: chietkhau,
      request_id: request_id, // Lưu request_id vào CSDL
      tran_id: trans_id,
      mota: "Nạp thẻ cào",
    });

    return res.status(201).json({
      message: "Nạp thẻ thành công",
      transaction: newTransaction,
    });
  } catch (error) {
    console.error("Error creating transaction:", error.message);
    return res.status(500).json({ error: error.message });
  }
};
