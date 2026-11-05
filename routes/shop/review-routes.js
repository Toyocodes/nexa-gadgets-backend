const express = require("express");

const {
  addProductReview,
  getProductReviews,
} = require("../../controllers/shop/product-review-controller");
const { authenticate, bindUserId } = require("../../middleware/auth");

const router = express.Router();

router.post("/add", authenticate, bindUserId, addProductReview);
router.get("/:productId", getProductReviews);

module.exports = router;
