const express = require("express");
const { getActiveDeliveryOptions } = require("../../controllers/common/delivery-controller");

const router = express.Router();

router.get("/", getActiveDeliveryOptions);

module.exports = router;
