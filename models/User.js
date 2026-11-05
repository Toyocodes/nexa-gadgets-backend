const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      default: "user",
      // enum: ["user", "admin"],
    },
    marketingOptIn: {
      type: Boolean,
      default: false,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpire: {
      type: Date,
    },
    // One-time "email me a sign-in link" token (stored hashed, like the reset token).
    loginToken: {
      type: String,
    },
    loginTokenExpire: {
      type: Date,
    },
  },
  { timestamps: true },
);

const User = mongoose.model("User", UserSchema);
module.exports = User;
