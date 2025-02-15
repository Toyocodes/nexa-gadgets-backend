// controllers/order-controller.js

const axios = require("axios");
const Order = require("../../models/Order");
const Cart = require("../../models/Cart");
const Product = require("../../models/Product");

// Create an order record in the database
const createOrder = async (req, res) => {
  try {
    const {
      userId,
      cartItems,
      addressInfo,
      orderStatus,
      paymentMethod,
      paymentStatus,
      totalAmount,
      orderDate,
      orderUpdateDate,
      cartId,
    } = req.body;

    const newlyCreatedOrder = new Order({
      userId,
      cartId,
      cartItems,
      addressInfo,
      orderStatus,       // typically "pending"
      paymentMethod,     // should be "paystack"
      paymentStatus,     // "pending"
      totalAmount,
      orderDate,
      orderUpdateDate,
      paymentId: "",
      payerId: "",
    });

    await newlyCreatedOrder.save();

    res.status(201).json({
      success: true,
      orderId: newlyCreatedOrder._id,
      totalAmount: newlyCreatedOrder.totalAmount,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

// Verify Paystack payment by calling Paystack's verify API
const verifyPayment = async (req, res) => {
  try {
    const { reference, orderId } = req.body;

    let order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order cannot be found",
      });
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY; // set in your .env (e.g., sk_test_...)
    const url = `https://api.paystack.co/transaction/verify/${reference}`;
    const config = {
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    };

    const response = await axios.get(url, config);
    // Check if the transaction status is "success"
    if (response.data.data.status === "success") {
      // Update order status
      order.paymentStatus = "paid";
      order.orderStatus = "confirmed";
      order.paymentId = reference; // use the Paystack reference as paymentId

      // Deduct product stock
      for (let item of order.cartItems) {
        let product = await Product.findById(item.productId);
        if (!product) {
          return res.status(404).json({
            success: false,
            message: `Product not found for item ${item.title}`,
          });
        }
        product.totalStock -= item.quantity;
        await product.save();
      }

      // Delete the cart after order confirmation
      await Cart.findByIdAndDelete(order.cartId);

      await order.save();
      return res.status(200).json({
        success: true,
        message: "Order confirmed",
        data: order,
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getAllOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await Order.find({ userId });
    if (!orders.length) {
      return res.status(404).json({
        success: false,
        message: "No orders found!",
      });
    }
    res.status(200).json({
      success: true,
      data: orders,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found!",
      });
    }
    res.status(200).json({
      success: true,
      data: order,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  getAllOrdersByUser,
  getOrderDetails,
};



