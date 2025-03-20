const crypto = require("crypto");
const RechargeCard = require("../models/TransactionSchema");
const Transaction = require("../models/HistoryUser");
const User = require("../models/User"); // Đảm bảo import model User
const cron = require("node-cron");
const axios = require("axios");

/**
 * Controller cập nhật trạng thái thẻ cào
 */
exports.rechargeCardStatus = async () => {
    try {
        console.log("🔄 Đang kiểm tra và cập nhật trạng thái thẻ cào...");

        // Lấy tất cả các thẻ cào có trạng thái 'pending'
        const pendingCards = await RechargeCard.find({ status: "pending" });
        console.log("ccard ", pendingCards);

        // Lấy cấu hình đối tác từ biến môi trường
        const partner_id = process.env.PARTNER_ID || "your_partner_id";
        const percent_card = Number(process.env.PERCENT_CARD);
        const partner_key = process.env.PARTNER_KEY || "your_partner_key";

        for (const card of pendingCards) {
            // Tạo chữ ký MD5: partner_key + card.code + card.serial
            const sign = crypto
                .createHash("md5")
                .update(partner_key + card.code + card.serial)
                .digest("hex");
            console.log("sign:", sign);

            const command = "check";
            // Tạo form-data để gửi đến API đối tác
            const FormData = require("form-data");
            const formdata = new FormData();
            formdata.append("telco", card.type);
            formdata.append("code", card.code);
            formdata.append("serial", card.serial);
            formdata.append("amount", card.amount);
            formdata.append("request_id", card.request_id);
            formdata.append("partner_id", partner_id);
            formdata.append("sign", sign);
            formdata.append("command", command);

            // Gửi yêu cầu lên API đối tác
            const statusCard = await axios.post(process.env.API_URLCARD, formdata, {
                headers: {
                    ...formdata.getHeaders(),
                },
            });
            console.log("Trạng thái trả về từ API đối tác:", statusCard.data);

            // Kiểm tra kết quả trả về từ API dựa trên status code
            const apiStatus = statusCard.data.status;
            // Nếu API có trả về thông báo lỗi cụ thể (ví dụ: trong trường message), bạn có thể lấy thông tin đó
            const errorMessage = statusCard.data.message || "";

            if (typeof apiStatus !== "undefined") {
                if (apiStatus === 1) {
                    // 1: Thẻ thành công đúng mệnh giá
                    const userData = await User.findOne({ username: card.username });
                    if (!userData) {
                        console.error(`Không tìm thấy người dùng: ${card.username}`);
                        continue;
                    }

                    const chietkhau = card.amount - (card.amount * percent_card / 100);
                    const note = `Bạn đã nạp thành công ${chietkhau.toLocaleString("vi-VN")} VNĐ từ thẻ cào. Số dư tài khoản của bạn là ${(userData.balance + chietkhau).toLocaleString("vi-VN")} VNĐ`;

                    // Tạo giao dịch mới (HistoryUser)
                    await Transaction.create({
                        username: userData.username,
                        madon: " ", // hoặc giá trị định danh giao dịch khác
                        hanhdong: "nạp tiền thẻ cào",
                        tongtien: chietkhau,
                        tienhientai: userData.balance,
                        tienconlai: userData.balance + chietkhau,
                        mota: note,
                    });

                    // Cập nhật thẻ cào và số dư của người dùng
                    card.real_amount = chietkhau;
                    card.status = "success";
                    await card.save();

                    userData.balance += chietkhau;
                    userData.tongnapthang = (userData.tongnapthang || 0) + chietkhau;

                    userData.tongnap = (userData.tongnap || 0) + chietkhau;
                    await userData.save();
                    const taoluc = new Date();
                    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
                    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
                    if (telegramBotToken && telegramChatId) {
                        const telegramMessage = `📌 *Cộng tiền!*\n\n` +
                            `👤 *Khách hàng:* ${card.username}\n` +
                            `👤 *Cộng tiền:*  nạp thẻ thành công số tiền  ${chietkhau}.\n` +
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
                } else if (apiStatus === 2) {
                    // 2: Thẻ thành công sai mệnh giá (chỉ nhận 50% mệnh giá)
                    const userData = await User.findOne({ username: card.username });
                    if (!userData) {
                        console.error(`Không tìm thấy người dùng: ${card.username}`);
                        continue;
                    }

                    // Tính số tiền thực nhận bằng 50% của mệnh giá
                    const chietkhau2 = statusCard.data.amount * 0.5;
                    const note = `Thẻ cào thành công nhưng sai mệnh giá. chỉ nhận ${chietkhau2.toLocaleString("vi-VN")} VNĐ.`;

                    // Tạo giao dịch với trạng thái cảnh báo
                    await Transaction.create({
                        username: userData.username,
                        madon: " ", // hoặc giá trị định danh giao dịch khác
                        hanhdong: "nạp tiền thẻ cào - sai mệnh giá",
                        tongtien: chietkhau2,
                        tienhientai: userData.balance,
                        tienconlai: userData.balance + chietkhau2,
                        mota: note,
                    });

                    // Cập nhật thẻ cào và số dư
                    card.real_amount = chietkhau2;
                    card.status = "warning"; // hoặc bạn có thể tạo status riêng như "warning"
                    await card.save();

                    userData.balance += chietkhau2;
                    userData.tongnapthang = (userData.tongnapthang || 0) + chietkhau2;

                    userData.tongnap = (userData.tongnap || 0) + chietkhau2;
                    await userData.save();

                    const taoluc = new Date();
                    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
                    const telegramChatId = process.env.TELEGRAM_CHAT_ID;
                    if (telegramBotToken && telegramChatId) {
                        const telegramMessage = `📌 *Cộng tiền!*\n\n` +
                            `👤 *Khách hàng:* ${card.username}\n` +
                            `👤 *Cộng tiền:*  nạp thẻ thành công số tiền  ${chietkhau2} và sai mệnh giá.\n` +
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
                } else if (apiStatus === 3 || apiStatus === 101) {
                    // 3: Thẻ lỗi
                    card.status = "failed";
                    card.real_amount = 0;
                    await card.save();
                } else if (apiStatus === 4) {
                    // 4: Hệ thống bảo trì
                    // Bạn có thể cập nhật status thành "maintenance" hoặc giữ lại pending để thử lại sau
                    card.status = "maintenance";
                    await card.save();
                } else if (apiStatus === 99) {
                    // 99: Thẻ chờ xử lý - giữ nguyên trạng thái pending, không làm gì thêm
                    console.log(`Thẻ ${card.code} đang chờ xử lý.`);
                } else if (apiStatus === 100) {
                    // 100: Gửi thẻ thất bại - có lý do đi kèm
                    card.status = "failed";
                    card.real_amount = 0;
                    // Nếu API trả về lý do, bạn có thể lưu vào trường mota hoặc một trường khác
                    card.mota = `Gửi thẻ thất bại: ${errorMessage}`;
                    await card.save();
                }
            }
        }

        console.log("✅ Cập nhật trạng thái thẻ cào hoàn tất");
    } catch (error) {
        console.error("⚠ Lỗi cập nhật trạng thái thẻ cào:", error.message);
    }
};

setInterval(async () => {
    console.log("⏳ Chạy cron job kiểm tra thẻ cào...");
    try {
        await exports.rechargeCardStatus();
    } catch (error) {
        console.error("Lỗi khi chạy rechargeCardStatus:", error);
    }
}, 30000); // 30,000 milliseconds = 30 seconds
