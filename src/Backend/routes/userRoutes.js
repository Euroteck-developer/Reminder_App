// routes/userRoutes.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const {verifyToken} = require("../middleware/authMiddleware");

// Get logged-in user details
router.get("/me", verifyToken, (req, res) => {
  const userId = req.user.id;

  const sql = `
    SELECT u.id, u.name, u.email, u.role_id, r.name AS role
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error", err });
    if (results.length === 0) return res.status(404).json({ message: "User not found" });

    res.json(results[0]);
  });
});

module.exports = router;
