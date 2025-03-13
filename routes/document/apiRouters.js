const express = require('express');
const router = express.Router();
const apiController = require('../../controllers/document/apiController'); // thay đổi đường dẫn cho phù hợp

// Tất cả các yêu cầu POST tới endpoint này sẽ được chuyển qua hàm routeRequest
router.post('/v2', apiController.routeRequest);

module.exports = router;
