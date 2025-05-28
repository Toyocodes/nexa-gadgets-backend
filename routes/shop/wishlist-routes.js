// const express = require("express");

// const {
//   addToWishlist,
//   getWishlist,
//   removeFromWishlist,
// } = require("../../controllers/shop/wishlist-controller");

// const router = express.Router();

// router.post("/add", addToWishlist);
// router.get("/get/:userId", getWishlist);
// router.delete("/delete/:userId/:productId", removeFromWishlist);

// module.exports = router;


const express = require("express");
const router = express.Router();
const wishlistController = require("../../controllers/shop/wishlist-controller");

// Get wishlist by userId (GET /shop/wishlist/get/:userId)
router.get("/get/:userId", wishlistController.getWishlist);

// Add to wishlist (POST /shop/wishlist/add)
router.post("/add", wishlistController.addToWishlist);

// Remove from wishlist (POST /shop/wishlist/delete)
router.delete("/delete/:userId/:productId", wishlistController.removeFromWishlist);

module.exports = router;



// const express = require('express');
// const router = express.Router();
// const wishlistController = require('../../controllers/shop/wishlist-controller');


// router.get('/get/:userId', wishlistController.getWishlist);
// router.post('/add', wishlistController.addToWishlist);
// router.delete('/delete/:productId', wishlistController.removeFromWishlist);

// module.exports = router;

