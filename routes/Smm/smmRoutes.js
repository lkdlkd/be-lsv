const express = require("express");
const router = express.Router();
const smmController = require("../../controllers/Smm/smmController");

router.post("/", smmController.createPartner);
router.get("/", smmController.getAllPartners);
router.get("/:id", smmController.getPartnerById);
router.put("/:id", smmController.updatePartner);
router.delete("/:id", smmController.deletePartner);

module.exports = router;
