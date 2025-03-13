const cron = require('node-cron');
const axios = require('axios');
const Service = require('../../models/Service');
const SmmSv = require('../../models/SmmSv');

// Hàm kiểm tra và cập nhật giá dịch vụ
async function updateServicePrices() {
  try {
    // Lấy toàn bộ dịch vụ trong CSDL
    const services = await Service.find({});
    console.log(`Đang kiểm tra ${services.length} dịch vụ...`);

    // Duyệt qua từng dịch vụ
    for (const serviceItem of services) {
      try {
        // Lấy cấu hình API theo DomainSmm của dịch vụ hiện tại
        const smmSvConfig = await SmmSv.findOne({ name: serviceItem.DomainSmm });
        if (!smmSvConfig || !smmSvConfig.url_api || !smmSvConfig.api_token) {
          console.warn(`Cấu hình API chưa được thiết lập cho dịch vụ ${serviceItem.name}`);
          continue;
        }

        // Gọi API bên thứ 3 để lấy danh sách dịch vụ
        const apiResponse = await axios.post(smmSvConfig.url_api, {
          key: smmSvConfig.api_token,
          action: 'services'
        });
        
        if (!apiResponse.data || !Array.isArray(apiResponse.data)) {
          console.warn(`Dữ liệu API không hợp lệ cho dịch vụ ${serviceItem.name}`);
          continue;
        }
        
        // Tìm dịch vụ có serviceId tương ứng trong kết quả API (ép kiểu về Number nếu cần)
        const apiService = apiResponse.data.find(
          s => Number(s.service) === Number(serviceItem.serviceId)
        );
        if (!apiService) {
          console.warn(`Không tìm thấy dịch vụ ${serviceItem.serviceId} trong API cho ${serviceItem.name}`);
          continue;
        }
        
        // Lấy giá từ API và so sánh với giá trong CSDL (làm tròn 2 số thập phân)
        const apiRate = parseFloat(apiService.rate*25 .toFixed(2));
        const dbRate = parseFloat(serviceItem.rate.toFixed(2));
        
        console.log(`Dịch vụ ${serviceItem.name} - Giá DB: ${dbRate}, Giá API: ${apiRate}`);
        
        // Nếu giá trong CSDL thấp hơn giá API thì cập nhật
        if (dbRate < apiRate) {
          const newRate = parseFloat((apiRate * 1.1).toFixed(2)); // cập nhật với 10% tăng thêm
          serviceItem.rate = newRate;
          await serviceItem.save();
          console.log(`Đã cập nhật giá của ${serviceItem.name} thành ${newRate}`);
        } else {
          console.log(`Giá của ${serviceItem.name} đã bằng hoặc cao hơn giá API, bỏ qua cập nhật.`);
        }
      } catch (innerError) {
        console.error(`Lỗi khi xử lý dịch vụ ${serviceItem.name}:`, innerError.message);
      }
    }
  } catch (error) {
    console.error("Lỗi khi lấy danh sách dịch vụ:", error.message);
  }
}

// Đặt lịch chạy cron job, ví dụ: chạy mỗi 1 giờ
cron.schedule('*/3 * * * *', () => {
  console.log("Cron job: Bắt đầu kiểm tra giá dịch vụ mỗi phút");
  updateServicePrices();
});
