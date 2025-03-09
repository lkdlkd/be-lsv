const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true }, // Không cần required, vì chúng ta sẽ tự gán nếu chưa có
  username: { type: String, required: true, unique: true },
  name: { type: String },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  balance: { type: Number, default: 100 },
  tongnap: { type: Number, default: 100 },
  capbac: { type: String, default: "thành viên" },
  token: { type: String }, // Không cần required, sẽ cập nhật sau khi tạo token
});

// Pre-save hook: mã hóa mật khẩu và cập nhật userId nếu chưa có
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  // Nếu chưa có userId, gán giá trị _id của document
  if (!this.userId) {
    this.userId = this._id.toString();
  }
  next();
});

// Phương thức kiểm tra mật khẩu
userSchema.methods.comparePassword = async function (password) {
  return await bcrypt.compare(password, this.password);
};

module.exports = mongoose.model("User", userSchema);
