const express = require("express");
const router = express.Router();
const toolController = require("../controllers/tool/getuid");

// Định nghĩa route POST cho /api/tool/getUid
router.post("/getUid", toolController.getUid);

module.exports = router;
