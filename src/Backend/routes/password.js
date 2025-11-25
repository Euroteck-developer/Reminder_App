const express = require("express");
const router = express.Router();
const { sendOtp, verifyOtp, resetPassword } = require("../controllers/passwordController");

// Step 1: Send OTP
router.post("/send-otp", sendOtp);

// Step 2: Verify OTP
router.post("/verify-otp", verifyOtp);

// Step 3: Reset password
router.post("/reset-password", resetPassword);

module.exports = router;
