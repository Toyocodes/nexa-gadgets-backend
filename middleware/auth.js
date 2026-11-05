const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is not set. Add it to your environment variables.");
}

const signToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "1d" });

// Verifies the httpOnly "token" cookie and attaches the decoded user to req.user.
const authenticate = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ success: false, message: "Unauthorised user!" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: "Unauthorised user!" });
  }
};

// Must run after authenticate.
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
};

// Must run after authenticate. Rejects requests whose :userId route param
// belongs to someone else, and overwrites any client-supplied body.userId
// with the id from the verified token, so a user can only act on their own data.
const bindUserId = (req, res, next) => {
  const ownId = String(req.user.id);

  if (req.params.userId && req.params.userId !== ownId) {
    return res.status(403).json({ success: false, message: "Forbidden" });
  }

  if (req.body && typeof req.body === "object") {
    req.body.userId = ownId;
  }
  next();
};

module.exports = { signToken, authenticate, requireAdmin, bindUserId };
