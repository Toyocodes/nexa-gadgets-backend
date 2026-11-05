/**
 * One-off migration for products created before `images`, `specs` and
 * `numReviews` existed. Safe to run more than once.
 *
 *   npm run backfill:products
 *
 * - images:        set to [image] when empty
 * - specs:         set to [] when missing
 * - averageReview,
 *   numReviews:    recalculated from the reviews collection
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Product = require("../models/Product");
const ProductReview = require("../models/Review");

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const stats = await ProductReview.aggregate([
    { $group: { _id: "$productId", average: { $avg: "$reviewValue" }, count: { $sum: 1 } } },
  ]);
  const statsByProduct = new Map(stats.map((s) => [String(s._id), s]));

  const products = await Product.find({});
  for (const product of products) {
    const s = statsByProduct.get(String(product._id));
    product.averageReview = s ? Math.round(s.average * 10) / 10 : 0;
    product.numReviews = s ? s.count : 0;
    if (!product.specs) product.specs = [];
    await product.save(); // the pre-save hook fills images from image
  }

  console.log(`Backfilled ${products.length} products.`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
