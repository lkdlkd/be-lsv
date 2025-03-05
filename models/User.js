const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  userId :{ type: String, required: false, unique: true },
  username: { type: String, required: true, unique: true },
  name:{ type: String, required: false },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  balance: { type: Number, default: 0 }, // Số dư mặc định khi tạo tài khoản
  tongnap: { type: Number, default: 0 }, // Tổng tiền đã nạp

});

// Mã hóa mật khẩu trước khi lưu
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Phương thức kiểm tra mật khẩu
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
