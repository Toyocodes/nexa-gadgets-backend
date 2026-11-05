const express = require("express");

const {
  addToCart,
  fetchCartItems,
  deleteCartItem,
  updateCartItemQty,
} = require("../../controllers/shop/cart-controller");
const { authenticate, bindUserId } = require("../../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.post("/add", bindUserId, addToCart);
router.get("/get/:userId", bindUserId, fetchCartItems);
router.put("/update-cart", bindUserId, updateCartItemQty);
router.delete("/:userId/:productId", bindUserId, deleteCartItem);

module.exports = router;
