const Wishlist = require("../../models/Wishlist");
const Product = require("../../models/Product");

// Add product to wishlist
exports.addToWishlist = async (req, res) => {
  try {
    const { userId, productId } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ message: "UserId and ProductId are required" });
    }

    // Check if already in wishlist to avoid duplicates
    const existing = await Wishlist.findOne({ userId, productId });
    if (existing) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    const wishlistItem = new Wishlist({ userId, productId });
    await wishlistItem.save();

    // Populate product info for frontend ease
    const populatedItem = await wishlistItem.populate("productId");


    res.status(201).json({ message: "Added to wishlist", data: populatedItem });

  } catch (error) {
    console.error("Add to wishlist error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Get wishlist for a user (with product details)
exports.getWishlist = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId) return res.status(400).json({ message: "UserId is required" });


     const wishlistItems = await Wishlist.find({ userId })
      .populate({
        path: 'productId',
        select: '_id image title price salePrice rating numReviews averageReview' // Add all needed fields
      });


    // Format data as array of objects { _id: wishlistItem._id, product: productDoc }
    const data = wishlistItems.map((item) => ({
      _id: item._id,
      product: item.productId,
    }));

    res.status(200).json({ data });
  } catch (error) {
    console.error("Get wishlist error:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

// Remove product from wishlist

exports.removeFromWishlist = async (req, res) => {
  try {
    const { userId, productId } = req.params;

    if (!userId || !productId) {
      return res.status(400).json({ message: "UserId and ProductId are required" });
    }

    const deleted = await Wishlist.findOneAndDelete({ userId, productId });

    if (!deleted) {
      return res.status(404).json({ message: "Item not found in wishlist" });
    }

    res.status(200).json({ message: "Removed from wishlist", data: productId });
  } catch (err) {
    console.error("Remove from wishlist error:", err);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
