const { rateLimit } = require("express-rate-limit");

const limitResponse = (message) => ({ success: false, message });

// Sign in, sign up, password reset and sign-in link verification.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitResponse("Too many attempts. Please wait a few minutes and try again."),
});

// Endpoints that send an email (forgot password, sign-in link), so they
// can't be used to flood someone's inbox.
const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: limitResponse("Too many email requests. Please wait 15 minutes and try again."),
});

module.exports = { authLimiter, emailLimiter };
