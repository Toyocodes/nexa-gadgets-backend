const express = require("express");

const {
  addFeatureImage,
  getFeatureImages,
} = require("../../controllers/common/feature-controller");
const { authenticate, requireAdmin } = require("../../middleware/auth");

const router = express.Router();

router.post("/add", authenticate, requireAdmin, addFeatureImage);
router.get("/get", getFeatureImages);

module.exports = router;
