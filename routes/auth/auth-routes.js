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

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.get("/check-auth", authMiddleware, (req, res) => {
  const user = req.user;
  res.status(200).json({
    success: true,
    message: "Authenticated user!",
    user,
  });
});

router.post("/forgot-password", forgotPassword);
router.put("/reset-password/:token", resetPassword);

// Account details
router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.put("/change-password", authMiddleware, changePassword);

// Email sign-in link
router.post("/magic-link", requestMagicLink);
router.post("/magic-link/verify", verifyMagicLink);

module.exports = router;
