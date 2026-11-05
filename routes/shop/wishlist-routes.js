const express = require("express");

const {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} = require("../../controllers/shop/wishlist-controller");
const { authenticate, bindUserId } = require("../../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.get("/get/:userId", bindUserId, getWishlist);
router.post("/add", bindUserId, addToWishlist);
router.delete("/delete/:userId/:productId", bindUserId, removeFromWishlist);

module.exports = router;
