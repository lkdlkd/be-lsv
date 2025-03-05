const express = require("express");
const userControlll = require("../../controllers/user/userControlll");
const { getHistoryByUsername } = require("../../controllers/user/GetHistoryUser");

const router = express.Router();

router.post("/login",userControlll.login );
router.post("/register",userControlll.register );
router.get('/:userId', userControlll.getBalance);

router.get('/', userControlll.getUsers);
router.put('/add/:id/balance', userControlll.addBalance);

router.put('/update/:id', userControlll.updateUser);
router.delete('/delete/:id', userControlll.deleteUser);

router.get('/history/:username', getHistoryByUsername);



module.exports = router;
