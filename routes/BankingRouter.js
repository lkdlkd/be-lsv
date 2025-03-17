const express = require('express');
const router = express.Router();
const bankController = require('../controllers/BankingController');
const { authenticate } = require('../controllers/user/authenticate'); // Đường dẫn đúng đến file middleware
const { createTransaction } = require("../controllers/transactionController");

router.post('/creatbank',authenticate, bankController.createBank);
router.put('/banks/:id',authenticate, bankController.updateBank);
router.delete('/banks/:id',authenticate, bankController.deleteBank);
router.get('/banks',authenticate, bankController.getBank);
router.post("/transactions", createTransaction);
module.exports = router;