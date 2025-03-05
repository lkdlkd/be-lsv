const express = require('express');
const router = express.Router();
// Import hàm addOrder từ file addOrder.js
const { addOrder } = require('../../controllers/order/addOrder');
const { getOrdersByCategoryAndUser , GetOrderscreach } = require('../../controllers/order/getIdOrder');
const { getAllOrder , deleteOrder } = require('../../controllers/order/getAllOrder');


router.post('/add', addOrder);
router.get('/orders', getOrdersByCategoryAndUser);
router.get('/getOrder', getAllOrder);
router.delete('/:orderId', deleteOrder);
router.get('/screach', GetOrderscreach);

module.exports = router;
