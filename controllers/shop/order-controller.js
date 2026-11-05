const axios = require("axios");
const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");
const Address = require("../../models/Address");

const effectivePrice = (product) =>
  product.salePrice > 0 ? product.salePrice : product.price;

// Creates a pending order. Items, prices, total and address are all read from
// the database (the user's own cart and saved address) rather than trusted
// from the request body, so the client cannot change what it will be charged.
const createOrder = async (req, res) => {
  try {
    const userId = req.user.id;
    const addressId = req.body.addressInfo?.addressId;

    const cart = await Cart.findOne({ userId }).populate({
      path: "items.productId",
      select: "image title price salePrice totalStock",
    });

    const items = (cart?.items || []).filter((item) => item.productId);
    if (!items.length) {
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    const address = await Address.findOne({ _id: addressId, userId });
    if (!address) {
      return res.status(400).json({ success: false, message: "Please select a valid address" });
    }

    const outOfStock = items.find((item) => item.quantity > item.productId.totalStock);
    if (outOfStock) {
      return res.status(400).json({
        success: false,
        message: `Only ${outOfStock.productId.totalStock} of ${outOfStock.productId.title} left in stock`,
      });
    }

    const cartItems = items.map((item) => ({
      productId: item.productId._id.toString(),
      title: item.productId.title,
      image: item.productId.image,
      price: String(effectivePrice(item.productId)),
      quantity: item.quantity,
    }));

    const totalAmount = items.reduce(
      (sum, item) => sum + effectivePrice(item.productId) * item.quantity,
      0
    );

    const now = new Date();
    const newlyCreatedOrder = await Order.create({
      userId,
      cartId: cart._id.toString(),
      cartItems,
      addressInfo: {
        addressId: address._id.toString(),
        address: address.address,
        city: address.city,
        pincode: address.pincode,
        phone: address.phone,
        notes: address.notes,
      },
      orderStatus: "pending",
      paymentMethod: "paystack",
      paymentStatus: "pending",
      totalAmount,
      orderDate: now,
      orderUpdateDate: now,
      paymentId: "",
      payerId: "",
    });

    res.status(201).json({
      success: true,
      orderId: newlyCreatedOrder._id,
      totalAmount: newlyCreatedOrder.totalAmount,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

// Confirms a Paystack payment. The order is only marked paid when Paystack
// reports success for exactly the order total in NGN, the order belongs to the
// caller, and the reference has not already been used for another order.
const verifyPayment = async (req, res) => {
  try {
    const { reference, orderId } = req.body;

    if (!reference || typeof reference !== "string") {
      return res.status(400).json({ success: false, message: "Payment reference is required" });
    }

    const order = await Order.findOne({ _id: orderId, userId: req.user.id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order cannot be found" });
    }

    // Idempotent: verifying an already-paid order again is a no-op.
    if (order.paymentStatus === "paid") {
      return res.status(200).json({ success: true, message: "Order confirmed", data: order });
    }

    const referenceInUse = await Order.exists({ paymentId: reference, _id: { $ne: order._id } });
    if (referenceInUse) {
      return res.status(400).json({ success: false, message: "Payment reference already used" });
    }

    const response = await axios.get(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` } }
    );
    const transaction = response.data?.data;

    const expectedAmount = Math.round(order.totalAmount * 100); // kobo
    const isValid =
      transaction?.status === "success" &&
      transaction.amount === expectedAmount &&
      transaction.currency === "NGN";

    if (!isValid) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    // Claim the order atomically so two concurrent verify calls can't both
    // deduct stock.
    const confirmedOrder = await Order.findOneAndUpdate(
      { _id: order._id, paymentStatus: { $ne: "paid" } },
      {
        paymentStatus: "paid",
        orderStatus: "confirmed",
        paymentId: reference,
        orderUpdateDate: new Date(),
      },
      { new: true }
    );

    if (!confirmedOrder) {
      const latest = await Order.findById(order._id);
      return res.status(200).json({ success: true, message: "Order confirmed", data: latest });
    }

    await Product.bulkWrite(
      confirmedOrder.cartItems.map((item) => ({
        updateOne: {
          filter: { _id: item.productId },
          update: { $inc: { totalStock: -item.quantity } },
        },
      }))
    );

    await Cart.findByIdAndDelete(confirmedOrder.cartId);

    return res.status(200).json({
      success: true,
      message: "Order confirmed",
      data: confirmedOrder,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

const getAllOrdersByUser = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id });
    if (!orders.length) {
      return res.status(404).json({ success: false, message: "No orders found!" });
    }
    res.status(200).json({ success: true, data: orders });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user.id });
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found!" });
    }
    res.status(200).json({ success: true, data: order });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred!" });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getAllOrdersByUser,
  getOrderDetails,
};
