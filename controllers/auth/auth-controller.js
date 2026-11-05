const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../../models/User");
const { sendActionEmail } = require("../../helpers/mailer");
const { signToken, authenticate } = require("../../middleware/auth");

const PASSWORD_MIN_LENGTH = 8;
const EMAIL_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const getTokenCookieOptions = () => ({
  httpOnly: true,
  path: "/",
  sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  secure: process.env.NODE_ENV === "production",
});

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const toClientUser = (user) => ({
  id: user._id,
  email: user.email,
  role: user.role,
  userName: user.userName,
});

// Signs a JWT for the user, sets it as the httpOnly cookie and returns the
// public user object the frontend stores.
const issueSession = (res, user) => {
  const token = signToken({
    id: user._id,
    role: user.role,
    email: user.email,
    userName: user.userName,
  });
  res.cookie("token", token, getTokenCookieOptions());
  return toClientUser(user);
};

const isValidPassword = (password) =>
  typeof password === "string" && password.length >= PASSWORD_MIN_LENGTH;

const registerUser = async (req, res) => {
  const { userName, email, password, marketingOptIn } = req.body;

  try {
    if (typeof userName !== "string" || !userName.trim() || typeof email !== "string" || !password) {
      return res.status(400).json({ success: false, message: "Username, email and password are required" });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    }

    if (await User.exists({ email })) {
      return res.json({
        success: false,
        message: "User Already exists with the same email! Please try again",
      });
    }
    if (await User.exists({ userName })) {
      return res.json({ success: false, message: "That username is taken. Please choose another" });
    }

    const newUser = await User.create({
      userName,
      email,
      password: await bcrypt.hash(password, 12),
      marketingOptIn: Boolean(marketingOptIn),
    });

    // New accounts are signed in straight away.
    const user = issueSession(res, newUser);

    res.status(200).json({ success: true, message: "Registration successful", user });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occured" });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ success: false, message: "Email and password are required" });
    }

    const checkUser = await User.findOne({ email });
    if (!checkUser)
      return res.json({
        success: false,
        message: "User doesn't exists! Please register first",
      });

    const checkPasswordMatch = await bcrypt.compare(password, checkUser.password);
    if (!checkPasswordMatch)
      return res.json({
        success: false,
        message: "Incorrect password! Please try again",
      });

    const user = issueSession(res, checkUser);

    res.json({ success: true, message: "Logged in successfully", user });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occured" });
  }
};

const logoutUser = (req, res) => {
  res.clearCookie("token", getTokenCookieOptions()).json({
    success: true,
    message: "Logged out successfully!",
  });
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    if (typeof email !== "string") {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.resetPasswordToken = hashToken(resetToken);
    user.resetPasswordExpire = Date.now() + EMAIL_TOKEN_TTL_MS;
    await user.save();

    await sendActionEmail({
      to: user.email,
      subject: "Password Reset Request",
      heading: "Password Reset Request",
      intro: "You requested to reset your password. Click the button below to choose a new one:",
      buttonText: "Reset Password",
      url: `${process.env.CLIENT_URL}/auth/reset-password/${resetToken}`,
      footer: "If you didn’t request this, you can ignore this email. This link expires in 10 minutes.",
    });

    res.status(200).json({ success: true, message: "Password reset email sent" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Email could not be sent" });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    if (!isValidPassword(password)) {
      return res.status(400).json({
        success: false,
        message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    }

    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ success: true, message: "Password reset successful" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ success: false, message: "Password reset failed" });
  }
};

// ---- Account details -------------------------------------------------------

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("userName email role marketingOptIn createdAt");
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.status(200).json({ success: true, data: user });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};

// Updates username, email and/or marketing preference. Changing the email
// requires the current password.
const updateMe = async (req, res) => {
  const { userName, email, marketingOptIn, currentPassword } = req.body;

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (userName !== undefined && userName !== user.userName) {
      if (typeof userName !== "string" || !userName.trim()) {
        return res.status(400).json({ success: false, message: "Username cannot be empty" });
      }
      if (await User.exists({ userName, _id: { $ne: user._id } })) {
        return res.status(409).json({ success: false, message: "That username is taken" });
      }
      user.userName = userName.trim();
    }

    if (email !== undefined && email !== user.email) {
      if (typeof email !== "string" || !EMAIL_PATTERN.test(email)) {
        return res.status(400).json({ success: false, message: "Enter a valid email address" });
      }
      if (!currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
        return res.status(401).json({ success: false, message: "Current password is incorrect" });
      }
      if (await User.exists({ email, _id: { $ne: user._id } })) {
        return res.status(409).json({ success: false, message: "That email is already in use" });
      }
      user.email = email;
    }

    if (marketingOptIn !== undefined) {
      user.marketingOptIn = Boolean(marketingOptIn);
    }

    await user.save();

    // Username/email live in the JWT, so issue a fresh one.
    const clientUser = issueSession(res, user);

    res.status(200).json({
      success: true,
      message: "Account updated",
      user: { ...clientUser, marketingOptIn: user.marketingOptIn },
    });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};

const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  try {
    if (!isValidPassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message: `New password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    }

    const user = await User.findById(req.user.id);
    if (!user || !currentPassword || !(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({ success: true, message: "Password changed" });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};

// ---- Email sign-in link ----------------------------------------------------

// Always answers with the same message so it can't be used to discover which
// emails have accounts.
const requestMagicLink = async (req, res) => {
  const { email } = req.body;
  const genericResponse = {
    success: true,
    message: "If an account exists for that email, a sign-in link is on its way",
  };

  try {
    if (!email || !EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ success: false, message: "Enter a valid email address" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(200).json(genericResponse);
    }

    const loginToken = crypto.randomBytes(32).toString("hex");
    user.loginToken = hashToken(loginToken);
    user.loginTokenExpire = Date.now() + EMAIL_TOKEN_TTL_MS;
    await user.save();

    await sendActionEmail({
      to: user.email,
      subject: "Your Nexa Gadgets sign-in link",
      heading: "Sign in to Nexa Gadgets",
      intro: "Click the button below to sign in. No password needed.",
      buttonText: "Sign in",
      url: `${process.env.CLIENT_URL}/auth/magic-link/${loginToken}`,
      footer: "If you didn’t request this, you can ignore this email. This link works once and expires in 10 minutes.",
    });

    res.status(200).json(genericResponse);
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Sign-in link could not be sent" });
  }
};

// Exchanges a one-time sign-in token for a session cookie.
const verifyMagicLink = async (req, res) => {
  const { token } = req.body;

  try {
    if (!token || typeof token !== "string") {
      return res.status(400).json({ success: false, message: "Sign-in token is required" });
    }

    const user = await User.findOneAndUpdate(
      { loginToken: hashToken(token), loginTokenExpire: { $gt: Date.now() } },
      { $unset: { loginToken: "", loginTokenExpire: "" } },
      { new: true }
    );

    if (!user) {
      return res.status(400).json({ success: false, message: "This sign-in link is invalid or has expired" });
    }

    const clientUser = issueSession(res, user);

    res.status(200).json({ success: true, message: "Logged in successfully", user: clientUser });
  } catch (e) {
    console.log(e);
    res.status(500).json({ success: false, message: "Some error occurred" });
  }
};

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
  authMiddleware: authenticate,
  forgotPassword,
  resetPassword,
  getMe,
  updateMe,
  changePassword,
  requestMagicLink,
  verifyMagicLink,
};
