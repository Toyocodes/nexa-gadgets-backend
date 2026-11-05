const express = require("express");

const {
  addAddress,
  fetchAllAddress,
  editAddress,
  deleteAddress,
} = require("../../controllers/shop/address-controller");
const { authenticate, bindUserId } = require("../../middleware/auth");

const router = express.Router();

router.use(authenticate);

router.post("/add", bindUserId, addAddress);
router.get("/get/:userId", bindUserId, fetchAllAddress);
router.delete("/delete/:userId/:addressId", bindUserId, deleteAddress);
router.put("/update/:userId/:addressId", bindUserId, editAddress);

module.exports = router;
