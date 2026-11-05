const Address = require("../../models/Address");

const REQUIRED_FIELDS = ["address", "city", "phone"];
const EDITABLE_FIELDS = ["address", "city", "pincode", "phone", "notes"];

// Copies only known address fields from the request body, trimming strings.
const pickAddressFields = (body) =>
  EDITABLE_FIELDS.reduce((fields, key) => {
    if (body[key] !== undefined) {
      fields[key] = typeof body[key] === "string" ? body[key].trim() : body[key];
    }
    return fields;
  }, {});

const missingRequired = (fields) => REQUIRED_FIELDS.filter((key) => !fields[key]);

const addAddress = async (req, res) => {
  try {
    const { userId } = req.body;
    const fields = pickAddressFields(req.body);
    const missing = missingRequired(fields);

    if (!userId || missing.length) {
      return res.status(400).json({
        success: false,
        message: `Please fill in: ${missing.join(", ")}`,
      });
    }

    const newlyCreatedAddress = await Address.create({
      userId,
      pincode: "",
      notes: "",
      ...fields,
    });

    res.status(201).json({
      success: true,
      data: newlyCreatedAddress,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

const fetchAllAddress = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User id is required!",
      });
    }

    const addressList = await Address.find({ userId });

    res.status(200).json({
      success: true,
      data: addressList,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

const editAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;

    if (!userId || !addressId) {
      return res.status(400).json({
        success: false,
        message: "User and address id is required!",
      });
    }

    const fields = pickAddressFields(req.body);
    const clearedRequired = REQUIRED_FIELDS.filter((key) => key in fields && !fields[key]);
    if (clearedRequired.length) {
      return res.status(400).json({
        success: false,
        message: `These fields cannot be empty: ${clearedRequired.join(", ")}`,
      });
    }

    const address = await Address.findOneAndUpdate({ _id: addressId, userId }, fields, {
      new: true,
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.status(200).json({
      success: true,
      data: address,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { userId, addressId } = req.params;
    if (!userId || !addressId) {
      return res.status(400).json({
        success: false,
        message: "User and address id is required!",
      });
    }

    const address = await Address.findOneAndDelete({ _id: addressId, userId });

    if (!address) {
      return res.status(404).json({
        success: false,
        message: "Address not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Address deleted successfully",
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

module.exports = { addAddress, editAddress, fetchAllAddress, deleteAddress };
