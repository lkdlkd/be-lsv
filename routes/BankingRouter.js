const express = require('express');
const router = express.Router();
const bankController = require('../controllers/BankingController');

router.post('/creatbank', bankController.createBank);
router.put('/banks/:id', bankController.updateBank);
router.delete('/banks/:id', bankController.deleteBank);
router.get('/banks', bankController.getBank);

module.exports = router;