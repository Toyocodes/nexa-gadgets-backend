require("dotenv").config();


const express = require("express");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const cors = require("cors");

//import routes
const authRouter = require("./routes/auth/auth-routes");
const adminProductsRouter = require("./routes/admin/products-routes");
const adminOrderRouter = require("./routes/admin/order-routes");
const analyticsRouter = require("./routes/admin/analytics-routes");

const shopProductsRouter = require("./routes/shop/products-routes");
const shopCartRouter = require("./routes/shop/cart-routes");
const shopAddressRouter = require("./routes/shop/address-routes");
const shopOrderRouter = require("./routes/shop/order-routes");
const shopSearchRouter = require("./routes/shop/search-routes");
const shopReviewRouter = require("./routes/shop/review-routes");

const commonFeatureRouter = require("./routes/common/feature-routes");
const wishlistRouter = require("./routes/shop/wishlist-routes");
const shopDeliveryRouter = require("./routes/shop/delivery-routes");
const adminDeliveryRouter = require("./routes/admin/delivery-routes");
const { authenticate, requireAdmin } = require("./middleware/auth");
const { ensureDefaultDeliveryOptions } = require("./controllers/common/delivery-controller");

//create a database connection -> u can also
//create a separate file for this and then import/use that file here

// Use environment variables
const MONGO_URI = process.env.MONGO_URI;
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("✅ MongoDB connected successfully!");
    await ensureDefaultDeliveryOptions();
  })
  .catch((error) => console.error("❌ MongoDB connection error:", error));

const app = express();

// Behind a hosting proxy (Render, Railway…) trust the first hop so rate
// limiting sees the real client IP instead of the proxy's.
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}


app.use(
  cors({
    // origin: "http://localhost:5173",
    origin: [
      "http://localhost:5173",          // Dev origin
      "https://nexagadgets.vercel.app" // Production origin (example)
    ],
    methods: ["GET", "POST", "DELETE", "PUT"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Expires",
      "Pragma",
    ],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use("/api/auth", authRouter);

// Every /api/admin/* route requires a logged-in user with role "admin".
app.use("/api/admin", authenticate, requireAdmin);
app.use("/api/admin/products", adminProductsRouter);
app.use("/api/admin/orders", adminOrderRouter);
app.use("/api/admin/analytics", analyticsRouter);
app.use("/api/admin/delivery-options", adminDeliveryRouter);
app.use("/api/shop/delivery-options", shopDeliveryRouter);
app.use("/api/shop/products", shopProductsRouter);
app.use("/api/shop/cart", shopCartRouter);
app.use("/api/shop/address", shopAddressRouter);
app.use("/api/shop/order", shopOrderRouter);
app.use("/api/shop/search", shopSearchRouter);
app.use("/api/shop/review", shopReviewRouter);

app.use("/api/common/feature", commonFeatureRouter);
app.use("/api/shop/wishlist", wishlistRouter);

app.listen(PORT, () => console.log(`Server is now running on port ${PORT}`));

