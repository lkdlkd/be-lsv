
const jwt = require("jsonwebtoken");
const User = require("../../models/User");

exports.authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Vui lòng đăng nhập" });

  try {
    const decoded = jwt.verify(token, "secretKey");
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: "Token không hợp lệ" });
  }
};
