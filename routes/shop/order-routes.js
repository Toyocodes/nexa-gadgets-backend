const express = require("express");

const {
  createOrder,
  getAllOrdersByUser,
  getOrderDetails,
  verifyPayment,
} = require("../../controllers/shop/order-controller");
const { authenticate, bindUserId } = require("../../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.post("/create", bindUserId, createOrder);
router.get("/list/:userId", bindUserId, getAllOrdersByUser);
router.get("/details/:id", getOrderDetails);
router.put("/verify", verifyPayment);

module.exports = router;
