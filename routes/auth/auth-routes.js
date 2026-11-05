const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  authMiddleware,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
  requestMagicLink,
  verifyMagicLink,
} = require("../../controllers/auth/auth-controller");
const { authLimiter, emailLimiter } = require("../../middleware/rate-limit");

const router = express.Router();

router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/logout", logoutUser);
router.get("/check-auth", authMiddleware, (req, res) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    message: "Authenticated user!",
    user,
  });
});

router.post("/forgot-password", emailLimiter, forgotPassword);
router.put("/reset-password/:token", authLimiter, resetPassword);

// Account details
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.put("/change-password", authLimiter, authMiddleware, changePassword);

// Email sign-in link
router.post("/magic-link", emailLimiter, requestMagicLink);
router.post("/magic-link/verify", authLimiter, verifyMagicLink);

module.exports = router;
