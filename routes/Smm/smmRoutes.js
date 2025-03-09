const express = require("express");
const router = express.Router();
const smmController = require("../../controllers/Smm/smmController");
const { authenticate } = require('../../controllers/user/authenticate'); // Đường dẫn đúng đến file middleware

router.post("/them",authenticate, smmController.createPartner);
router.get("/",authenticate, smmController.getAllPartners);
router.get("/:id",authenticate, smmController.getPartnerById);
router.put("/:id",authenticate, smmController.updatePartner);
router.delete("/:id",authenticate, smmController.deletePartner);

module.exports = router;
