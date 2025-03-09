const Service = require('../../models/Service');

// Thêm dịch vụ mới
exports.addService = async (req, res) => {
  try {
      const newService = new Service(req.body);
      await newService.save();
      res.status(201).json({ success: true, message: 'Dịch vụ được thêm thành công', data: newService });
  } catch (error) {
      res.status(400).json({ success: false, message: 'Lỗi khi thêm dịch vụ', error: error.message });
  }
};

// Lấy danh sách dịch vụ
exports.getServices = async (req, res) => {
    try {
      const services = await Service.find();
      
      // Giả sử bạn muốn hiển thị các trường: serviceId, name, rate, type, category
      const formattedServices = services.map(service => ({
        description : service.description,
        Magoi: service.Magoi,
        id : service.id,
        maychu : service.maychu,
        Linkdv : service.Linkdv,
        // serviceId: service.serviceId,  hoặc service.serviceId nếu bạn có trường này
        name: service.name,
        rate: service.rate,
        min: service.min,
        max: service.max,
        type: service.type,
        category: service.category,
        iscomment: service.comment,

        trangthai : service.isActive,
      }));
      
      res.status(200).json({ success: true, data: formattedServices });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: 'Lỗi khi lấy danh sách dịch vụ', 
        error: error.message 
      });
    }
  };
// Cập nhật dịch vụ
exports.updateService = async (req, res) => {
  try {
      const updatedService = await Service.findByIdAndUpdate(req.params.id, req.body, { new: true });
      if (!updatedService) {
          return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });
      }
      res.status(200).json({ success: true, message: 'Cập nhật dịch vụ thành công', data: updatedService });
  } catch (error) {
      res.status(400).json({ success: false, message: 'Lỗi khi cập nhật dịch vụ', error: error.message });
  }
};

// Xóa dịch vụ
exports.deleteService = async (req, res) => {
  try {
      const deletedService = await Service.findByIdAndDelete(req.params.id);
      console.log("id truyen vao ",id)
      if (!deletedService) {
          return res.status(404).json({ success: false, message: 'Dịch vụ không tồn tại' });
      }
      res.status(200).json({ success: true, message: 'Xóa dịch vụ thành công' });
  } catch (error) {
      res.status(500).json({ success: false, message: 'Lỗi khi xóa dịch vụ', error: error.message });
  }
};
