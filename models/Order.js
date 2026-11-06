const mongoose = require("mongoose");

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "inShipping",
  "readyForPickup",
  "delivered",
  "rejected",
];

const OrderSchema = new mongoose.Schema({
  userId: String,
  cartId: String,
  cartItems: [
    {
      productId: String,
      title: String,
      image: String,
      price: String,
      quantity: Number,
    },
  ],
  // Empty for pickup orders.
  addressInfo: {
    addressId: String,
    label: String,
    address: String,
    city: String,
    pincode: String,
    phone: String,
    notes: String,
  },
  // What the rider should know for this order. Starts from the saved address's
  // notes at checkout, and editing it there doesn't change the saved address.
  deliveryNotes: String,
  // Snapshot of the delivery option chosen at checkout, so later fee changes
  // don't affect this order.
  deliveryMethod: {
    optionId: String,
    name: String,
    type: { type: String, enum: ["pickup", "delivery"] },
    fee: Number,
    description: String,
  },
  orderStatus: String,
  paymentMethod: String,
  paymentStatus: String,
  // Paystack channel the payment actually came through, e.g. "bank_transfer".
  paymentChannel: String,
  subtotal: Number,
  deliveryFee: Number,
  // subtotal + deliveryFee — the amount charged.
  totalAmount: Number,
  orderDate: Date,
  orderUpdateDate: Date,
  paymentId: String,
  payerId: String,
}, {
  timestamps: true,
});

const Order = mongoose.model("Order", OrderSchema);
Order.ORDER_STATUSES = ORDER_STATUSES;

module.exports = Order;
