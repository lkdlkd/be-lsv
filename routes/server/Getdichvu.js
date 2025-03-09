const express = require('express');
const router = express.Router();
const serviceController = require('../../controllers/server/getServices');
const { authenticate } = require('../../controllers/user/authenticate'); // Đường dẫn đúng đến file middleware

// Định tuyến các API
router.post('/add',authenticate, serviceController.addService);
router.get('/',authenticate, serviceController.getServices);
router.put('/update/:id',authenticate, serviceController.updateService);
router.delete('/delete/:id',authenticate, serviceController.deleteService);

module.exports = router;
