const express = require('express');
const router = express.Router();
const serviceController = require('../../controllers/server/getServices');

// Định tuyến các API
router.post('/add', serviceController.addService);
router.get('/', serviceController.getServices);
router.put('/update/:id', serviceController.updateService);
router.delete('/delete/:id', serviceController.deleteService);

module.exports = router;
