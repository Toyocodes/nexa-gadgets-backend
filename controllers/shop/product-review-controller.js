const Order = require("../../models/Order");
const Product = require("../../models/Product");
const ProductReview = require("../../models/Review");

// Recalculates a product's averageReview and numReviews from its reviews.
const refreshProductRating = async (productId) => {
  const [stats] = await ProductReview.aggregate([
    { $match: { productId } },
    { $group: { _id: null, average: { $avg: "$reviewValue" }, count: { $sum: 1 } } },
  ]);

  await Product.findByIdAndUpdate(productId, {
    averageReview: stats ? Math.round(stats.average * 10) / 10 : 0,
    numReviews: stats ? stats.count : 0,
  });
};

const addProductReview = async (req, res) => {
  try {
    const { productId, userId, reviewMessage } = req.body;
    const reviewValue = Number(req.body.reviewValue);
    const userName = req.user.userName;

    if (!productId || !Number.isInteger(reviewValue) || reviewValue < 1 || reviewValue > 5) {
      return res.status(400).json({
        success: false,
        message: "Choose a rating from 1 to 5 stars",
      });
    }

    // Only a paid order counts as a purchase.
    const order = await Order.findOne({
      userId,
      "cartItems.productId": productId,
      paymentStatus: "paid",
    });

    if (!order) {
      return res.status(403).json({
        success: false,
        message: "You need to purchase product to review it.",
      });
    }

    const existingReview = await ProductReview.findOne({ productId, userId });
    if (existingReview) {
      return res.status(400).json({
        success: false,
        message: "You already reviewed this product!",
      });
    }

    const newReview = await ProductReview.create({
      productId,
      userId,
      userName,
      reviewMessage,
      reviewValue,
    });

    await refreshProductRating(productId);

    res.status(201).json({
      success: true,
      data: newReview,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

const getProductReviews = async (req, res) => {
  try {
    const { productId } = req.params;

    const reviews = await ProductReview.find({ productId }).sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
};

module.exports = { addProductReview, getProductReviews, refreshProductRating };
