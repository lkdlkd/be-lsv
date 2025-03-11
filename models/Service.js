const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  type : { type: String, required: false },//facebook, tiktok,instagram...
  name: { type: String, required: true },// tăng like tiktok, tăng view titkok
  description: { type: String, required: false },//mô tả sv
  maychu : { type: String, required: false },//sv1
  getid: { type: String, enum: ["on", "off"], default: "on" },//chức năng get id sau khi nhập link mua
  min: { type: Number, required: true },//min lấy bên thứ 3
  max: { type: Number, required: true },//max lấy bên thứ 3
  rate: { type: Number, required: true },//giá lấy bên thứ 3* với smmPartner.price_update,
  DomainSmm: { type: String, required: true },//bên thứ 3 lấy từ smmsv
  Linkdv: { type: String, required: true },//facebook-like, tiktok-view...
  serviceId: { type: String, required: true },//sv ở bên thứ 3
  serviceName: { type: String, required: true },//sv name ở bên thứ 3
  Magoi: { type: String, required: true },// ma goi moi khi thêm
  isActive: { type: Boolean, default: true }, // Hiển thị hoặc ẩn dịch vụ
  category: { type: String, required: true },//like fb/ sub fb...
  comment: { type: String, enum: ["on", "off"], default: "of" },//chức năng get id sau khi nhập link mua
  reaction: { type: String, enum: ["on", "off"], default: "of" },//chức năng get id sau khi nhập link mua
  matlive: { type: String, enum: ["on", "off"], default: "of" },//chức năng get id sau khi nhập link mua
}, { timestamps: true }); // Thêm createdAt và updatedAt tự động

module.exports = mongoose.model('Service', serviceSchema);
