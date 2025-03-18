const express = require("express");
const userControlll = require("../../controllers/user/userControlll");
const { getHistoryByUsername } = require("../../controllers/user/GetHistoryUser");
const { authenticate } = require('../../controllers/user/authenticate'); // Đường dẫn đúng đến file middleware

const router = express.Router();

router.post("/login",userControlll.login );
router.post("/register",userControlll.register );
// get thong tin ng dung
router.get('/:userId',authenticate, userControlll.getBalance);

router.get('/',authenticate, userControlll.getUsers);
router.put('/add/:id/balance',authenticate, userControlll.addBalance);
router.post('/:id/deduct-balance',authenticate, userControlll.deductBalance);

router.put('/changePassword/:id',authenticate, userControlll.changePassword);

router.put('/update/:id',authenticate, userControlll.updateUser);
router.delete('/delete/:id', authenticate,userControlll.deleteUser);

router.get('/history/:username', authenticate,getHistoryByUsername);



module.exports = router;
