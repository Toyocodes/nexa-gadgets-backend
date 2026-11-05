const express = require("express");
const {
  getAllDeliveryOptions,
  createDeliveryOption,
  updateDeliveryOption,
  deleteDeliveryOption,
} = require("../../controllers/common/delivery-controller");

// Mounted under /api/admin, which already requires an admin login.
const router = express.Router();

router.get("/", getAllDeliveryOptions);
router.post("/", createDeliveryOption);
router.put("/:id", updateDeliveryOption);
router.delete("/:id", deleteDeliveryOption);

module.exports = router;
