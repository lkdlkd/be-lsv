const cron = require('node-cron');
const axios = require('axios');
const Order = require('../../models/Order');
const Service = require('../../models/Service');
const SmmSv = require('../../models/SmmSv');

// Hàm chuyển đổi status theo yêu cầu
function mapStatus(apiStatus) {
  switch (apiStatus) {
    case "Processing":
      return "Processing";
    case "Completed":
      return "Completed";
    case "In progress":
      return "In progress";
    case "Canceled":
      return "Canceled";
    default:
      // Nếu là Pending hoặc giá trị khác, giữ nguyên status trong CSDL
      return null;
  }
}

// Hàm kiểm tra và cập nhật trạng thái đơn hàng đang chạy
async function checkOrderStatus() {
  try {
    // Lấy tất cả các đơn hàng đang chạy
    const runningOrders = await Order.find({
      status: { $in: ["Pending", "In progress"] }
    });
    if (runningOrders.length === 0) {
      console.log("Không có đơn hàng đang chạy.");
      return;
    }
    console.log(`Đang kiểm tra trạng thái của ${runningOrders.length} đơn hàng...`);

    // Tạo map để nhóm các đơn theo cấu hình SMM
    // key: id của SMM config, value: { config, orders: [order, ...] }
    const groups = {};

    for (const order of runningOrders) {
      // Tìm thông tin dịch vụ theo tên dịch vụ (namesv)
      const service = await Service.findOne({ serviceId: order.SvID });
      if (!service) {
        console.warn(`Không tìm thấy dịch vụ cho đơn ${order.Madon} (namesv: ${order.namesv})`);
        continue;
      }

      // Lấy cấu hình SMM theo DomainSmm của dịch vụ
      const smmConfig = await SmmSv.findOne({ name: service.DomainSmm });
      if (!smmConfig || !smmConfig.url_api || !smmConfig.api_token) {
        console.warn(`Cấu hình SMM không hợp lệ cho dịch vụ ${service.name}`);
        continue;
      }

      const groupKey = smmConfig._id.toString();
      if (!groups[groupKey]) {
        groups[groupKey] = {
          config: smmConfig,
          orders: [],
        };
      }
      groups[groupKey].orders.push(order);
    }

    // Duyệt qua từng nhóm và gọi API kiểm tra trạng thái
    for (const groupKey in groups) {
      const { config, orders } = groups[groupKey];

      // Nếu chỉ có 1 đơn thì gửi payload riêng cho đơn đó
      if (orders.length === 1) {
        const payload = {
          key: config.api_token,
          action: "status",
          order: orders[0].orderId
        };
        console.log(`Gọi API trạng thái cho đơn ${orders[0].orderId} với payload:`, payload);

        try {
          const response = await axios.post(config.url_api, payload);
          console.log("Trả về từ API:", response.data);

          const statusObj = Array.isArray(response.data) ? response.data[0] : response.data;
          const mappedStatus = mapStatus(statusObj.status);
          if (mappedStatus !== null) {
            orders[0].status = mappedStatus;
          }
          if (statusObj.start_count !== undefined) {
            orders[0].start = statusObj.start_count;
          }
          if (statusObj.remains !== undefined) {
            orders[0].dachay = orders[0].quantity - statusObj.remains;
          }
          await orders[0].save();
          console.log(`Đã cập nhật đơn ${orders[0].Madon}: status = ${mappedStatus || orders[0].status}, dachay = ${orders[0].dachay}`);
        } catch (apiError) {
          console.error(`Lỗi khi gọi API trạng thái cho config ${config.name}:`, apiError.message);
        }
      } else {
        // Nếu có nhiều đơn, gộp các orderId thành chuỗi ngăn cách bằng dấu phẩy
        const payload = {
          key: config.api_token,
          action: "status",
          orders: orders.map(order => order.orderId).join(',')
        };
        console.log(`Gọi API trạng thái cho các đơn với payload:`, payload);
        
        try {
          const response = await axios.post(config.url_api, payload);
          console.log("Trả về từ API:", response.data);

          // API trả về object với key là orderId
          const data = response.data;
          for (const orderId in data) {
            if (data.hasOwnProperty(orderId)) {
              const statusObj = data[orderId];
              // Tìm order tương ứng (ép kiểu về string nếu cần)
              const order = orders.find(o => o.orderId.toString() === orderId);
              if (order) {
                const mappedStatus = mapStatus(statusObj.status);
                if (mappedStatus !== null) {
                  order.status = mappedStatus;
                }
                if (statusObj.start_count !== undefined) {
                  order.start = statusObj.start_count;
                }
                if (statusObj.remains !== undefined) {
                  order.dachay = order.quantity - statusObj.remains;
                }
                await order.save();
                console.log(`Đã cập nhật đơn ${order.Madon}: status = ${mappedStatus || order.status}, dachay = ${order.dachay}`);
              } else {
                console.warn(`Không tìm thấy đơn nào tương ứng với orderId ${orderId}`);
              }
            }
          }
        } catch (apiError) {
          console.error(`Lỗi khi gọi API trạng thái cho config ${config.name}:`, apiError.message);
        }
      }
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái đơn hàng:", error.message);
  }
}

// Đặt lịch chạy cron job, ví dụ: chạy mỗi 1 phút
cron.schedule('*/1 * * * *', () => {
  console.log("Cron job: Bắt đầu kiểm tra trạng thái đơn hàng");
  checkOrderStatus();
});

