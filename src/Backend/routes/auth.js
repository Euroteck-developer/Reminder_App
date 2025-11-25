const express = require("express");
const router = express.Router();
const { loginUser, verifyPassword, changePassword, } = require("../controllers/authController");
const db = require("../db")

router.post("/login", loginUser);

//Verification-password
router.post("/verify-password", verifyPassword);

//Changing password
router.post("/change-password", changePassword);

module.exports = router;
