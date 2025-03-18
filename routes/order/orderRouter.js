const express = require('express');
const router = express.Router();
// Import hàm addOrder từ file addOrder.js
const { addOrder } = require('../../controllers/order/addOrder');
const { getOrdersByCategoryAndUser , GetOrderscreach } = require('../../controllers/order/getIdOrder');
const { getAllOrder , deleteOrder } = require('../../controllers/order/getAllOrder');
const { authenticate } = require('../../controllers/user/authenticate'); // Đường dẫn đúng đến file middleware


router.post('/add',authenticate, addOrder);
router.get('/orders',authenticate, getOrdersByCategoryAndUser);

router.get('/getOrder',authenticate, getAllOrder);

router.delete('/:orderId',authenticate, deleteOrder);
router.get('/screach',authenticate, GetOrderscreach);

module.exports = router;
