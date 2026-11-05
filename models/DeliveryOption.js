const mongoose = require("mongoose");

// A way to get an order to the customer. Admins edit these from the admin
// dashboard, so fees can change without a deploy. Orders store a snapshot of
// the option they used, so changing a fee never alters past orders.
const DeliveryOptionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    // "pickup": customer collects after paying online; no address needed.
    // "delivery": shipped to a saved address.
    type: { type: String, enum: ["pickup", "delivery"], required: true },
    fee: { type: Number, required: true, min: 0 },
    // Shown under the option, e.g. the pickup address or areas covered.
    description: { type: String, trim: true, maxlength: 300, default: "" },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("DeliveryOption", DeliveryOptionSchema);
