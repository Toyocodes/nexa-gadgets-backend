const mongoose = require("mongoose");
const DeliveryOption = require("../../models/DeliveryOption");

const DEFAULT_OPTIONS = [
  {
    name: "Pickup",
    type: "pickup",
    fee: 0,
    description: "Collect your order from our store after paying online.",
    sortOrder: 0,
  },
  {
    name: "Lagos Mainland delivery",
    type: "delivery",
    fee: 5000,
    description: "Delivered to your address on the Lagos Mainland.",
    sortOrder: 1,
  },
  {
    name: "Lagos Island delivery",
    type: "delivery",
    fee: 8000,
    description: "Delivered to your address on Lagos Island.",
    sortOrder: 2,
  },
];

// Creates the default options the first time the server starts against an
// empty collection. Never overwrites what an admin has set.
const ensureDefaultDeliveryOptions = async () => {
  if ((await DeliveryOption.estimatedDocumentCount()) === 0) {
    await DeliveryOption.insertMany(DEFAULT_OPTIONS);
    console.log("Seeded default delivery options");
  }
};

const PUBLIC_FIELDS = "name type fee description sortOrder";

// Validates and copies the editable fields. `partial` allows updates that
// only send some fields.
const parseOption = (body, { partial }) => {
  const fields = {};
  const errors = [];

  if (body.name !== undefined || !partial) {
    if (typeof body.name !== "string" || !body.name.trim()) errors.push("name is required");
    else if (body.name.trim().length > 60) errors.push("name must be 60 characters or fewer");
    else fields.name = body.name.trim();
  }
  if (body.type !== undefined || !partial) {
    if (!["pickup", "delivery"].includes(body.type)) errors.push('type must be "pickup" or "delivery"');
    else fields.type = body.type;
  }
  if (body.fee !== undefined || !partial) {
    const fee = Number(body.fee);
    if (body.fee === "" || !Number.isInteger(fee) || fee < 0 || fee > 10000000) {
      errors.push("fee must be a whole number of naira, 0 or more");
    } else fields.fee = fee;
  }
  if (body.description !== undefined) {
    if (typeof body.description !== "string" || body.description.length > 300) {
      errors.push("description must be text of 300 characters or fewer");
    } else fields.description = body.description.trim();
  }
  if (body.active !== undefined) fields.active = Boolean(body.active);
  if (body.sortOrder !== undefined) {
    const sortOrder = Number(body.sortOrder);
    if (!Number.isFinite(sortOrder)) errors.push("sortOrder must be a number");
    else fields.sortOrder = sortOrder;
  }

  return { fields, errors };
};

// ---- Public ----------------------------------------------------------------

// GET /api/shop/delivery-options — active options for checkout.
const getActiveDeliveryOptions = async (req, res) => {
  try {
    const options = await DeliveryOption.find({ active: true })
      .select(PUBLIC_FIELDS)
      .sort({ sortOrder: 1, fee: 1 });
    res.status(200).json({ success: true, data: options });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Could not load delivery options" });
  }
};

// ---- Admin -----------------------------------------------------------------

// GET /api/admin/delivery-options — every option, including inactive ones.
const getAllDeliveryOptions = async (req, res) => {
  try {
    const options = await DeliveryOption.find({}).sort({ sortOrder: 1, fee: 1 });
    res.status(200).json({ success: true, data: options });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Could not load delivery options" });
  }
};

// POST /api/admin/delivery-options
const createDeliveryOption = async (req, res) => {
  try {
    const { fields, errors } = parseOption(req.body, { partial: false });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }
    const option = await DeliveryOption.create(fields);
    res.status(201).json({ success: true, data: option });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Could not create delivery option" });
  }
};

// PUT /api/admin/delivery-options/:id — send only the fields to change.
const updateDeliveryOption = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Delivery option not found" });
    }
    const { fields, errors } = parseOption(req.body, { partial: true });
    if (errors.length) {
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }
    const option = await DeliveryOption.findByIdAndUpdate(req.params.id, fields, {
      new: true,
      runValidators: true,
    });
    if (!option) {
      return res.status(404).json({ success: false, message: "Delivery option not found" });
    }
    res.status(200).json({ success: true, data: option });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Could not update delivery option" });
  }
};

// DELETE /api/admin/delivery-options/:id — past orders keep their snapshot.
const deleteDeliveryOption = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ success: false, message: "Delivery option not found" });
    }
    const option = await DeliveryOption.findByIdAndDelete(req.params.id);
    if (!option) {
      return res.status(404).json({ success: false, message: "Delivery option not found" });
    }
    res.status(200).json({ success: true, message: "Delivery option deleted" });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Could not delete delivery option" });
  }
};

module.exports = {
  ensureDefaultDeliveryOptions,
  getActiveDeliveryOptions,
  getAllDeliveryOptions,
  createDeliveryOption,
  updateDeliveryOption,
  deleteDeliveryOption,
};
