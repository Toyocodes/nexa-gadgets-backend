const mongoose = require("mongoose");

const SpecSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    value: { type: String, required: true, trim: true },
  },
  { _id: false }
);

const ProductSchema = new mongoose.Schema(
  {
    // Primary image, kept for backwards compatibility. Always equals images[0]
    // when images is set.
    image: String,
    // Gallery images, in display order.
    images: { type: [String], default: [] },
    title: String,
    description: String,
    category: String,
    brand: String,
    price: Number,
    salePrice: Number,
    totalStock: Number,
    // Key specs shown as chips and in the spec table, e.g. { label: "RAM", value: "6GB" }.
    specs: { type: [SpecSchema], default: [] },
    averageReview: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Keep `image` and `images` in sync so old and new clients both work.
ProductSchema.pre("save", function syncImages(next) {
  if (this.images?.length) {
    this.image = this.images[0];
  } else if (this.image) {
    this.images = [this.image];
  }
  next();
});

module.exports = mongoose.model("Product", ProductSchema);
