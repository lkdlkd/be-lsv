const express = require('express');
const router = express.Router();
const get = require('../../controllers/thecao/GetController');
const { authenticate } = require('../../controllers/user/authenticate'); // Đường dẫn đúng đến file middleware

router.get('/thecao',authenticate,get.getThecao );

module.exports = router;