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
      status: { $in: ["Pending", "In progress",] }
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
      // console.log("Order namesv:", order.namesv);
      // console.log("Service:", service);
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
      // Tạo chuỗi các orderId, cách nhau bởi dấu phẩy
      const ordersStr = orders.map(o => o.orderId).join(',');

      const payload = {
        key: config.api_token,  // Sử dụng api_token từ cấu hình SMM
        action: "status",
        order: ordersStr
      };
      console.log(`Gọi API trạng thái cho ${orders.length} đơn với payload:`, payload);

      try {
        const response = await axios.post(config.url_api, payload);
        console.log("Trả về từ API:", response.data);

        let statusData = response.data;
        if (!Array.isArray(statusData)) {
          statusData = [statusData];
        }
        console.log("Status data sau khi chuyển đổi:", statusData);

        // Nếu các đối tượng status không chứa trường định danh đơn hàng,
        // coi như dữ liệu áp dụng cho tất cả các đơn trong nhóm
        if (statusData.length === 1 && !statusData[0].hasOwnProperty('order')) {
          const commonStatusObj = statusData[0];
          const mappedStatus = mapStatus(commonStatusObj.status);
          for (const orderToUpdate of orders) {
            if (mappedStatus !== null) {
              orderToUpdate.status = mappedStatus;
            }
            if (commonStatusObj.start_count !== undefined) {
              orderToUpdate.start = commonStatusObj.start_count;
            }
            // Cập nhật trường dachay: quantity - remains (nếu remains có giá trị)
            if (commonStatusObj.remains !== undefined) {
              orderToUpdate.dachay = orderToUpdate.quantity - commonStatusObj.remains;
            }
            await orderToUpdate.save();
            console.log(`Đã cập nhật đơn ${orderToUpdate.Madon}: status = ${mappedStatus || orderToUpdate.status}, dachay = ${orderToUpdate.dachay}`);
          }
        } else {
          // Nếu trả về mảng các đối tượng có trường định danh đơn hàng
          for (const statusObj of statusData) {
            try {
              console.log("Xử lý status object:", statusObj);
              const orderToUpdate = orders.find(o => o.orderId == statusObj.order);
              if (orderToUpdate) {
                const mappedStatus = mapStatus(statusObj.status);
                if (mappedStatus !== null) {
                  orderToUpdate.status = mappedStatus;
                }
                if (statusObj.start_count !== undefined) {
                  orderToUpdate.start = statusObj.start_count;
                }
                if (statusObj.remains !== undefined) {
                  orderToUpdate.dachay = orderToUpdate.quantity - statusObj.remains;
                }
                await orderToUpdate.save();
                console.log(`Đã cập nhật đơn ${orderToUpdate.Madon}: status = ${mappedStatus || orderToUpdate.status}, dachay = ${orderToUpdate.dachay}`);
              } else {
                console.warn(`Không tìm thấy đơn hàng khớp với orderId: ${statusObj.order}`);
              }
            } catch (innerError) {
              console.error("Lỗi khi xử lý status object:", innerError);
            }
          }
        }
      } catch (apiError) {
        console.error(`Lỗi khi gọi API trạng thái cho config ${config.name}:`, apiError.message);
      }
    }
  } catch (error) {
    console.error("Lỗi khi kiểm tra trạng thái đơn hàng:", error.message);
  }
}

// Đặt lịch chạy cron job, ví dụ: chạy mỗi phút
cron.schedule('*/5 * * * *', () => {
  console.log("Cron job: Bắt đầu kiểm tra trạng thái đơn hàng");
  checkOrderStatus();
});
