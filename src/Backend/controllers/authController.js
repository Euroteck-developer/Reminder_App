const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const db = require("../db");

dotenv.config();

// Login
const loginUser = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password required" });

  // Block soft-deleted users
  const query = "SELECT * FROM users WHERE email = ? AND is_deleted = 0";

  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0)
      return res.status(401).json({ message: "Invalid email or account deactivated" });

    const user = results[0];

    try {
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword)
        return res.status(401).json({ message: "Invalid email or password" });

      const token = jwt.sign(
        { id: user.id, email: user.email, role_id: user.role_id, level: user.level },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );

      // socket welcome notification
      const io = req.app.get("io");
      const onlineUsers = req.app.get("onlineUsers");
      const socketId = onlineUsers.get(user.id);

      if (socketId) {
        io.to(socketId).emit("newNotification", {
          title: "Login Successful",
          message: `Welcome back, ${user.name}! 🎉`,
        });
      }

      res.json({
        success: true,
        message: "Login successful",
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role_id: user.role_id,
          level: user.level
        },
      });
    } catch (error) {
      console.error(" Login error:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
};

// Verify old password
const verifyPassword = (req, res) => {
  const { email, oldPassword } = req.body;

  const sql = "SELECT password FROM users WHERE email = ?";
  db.query(sql, [email], async (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    if (results.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const hashedPassword = results[0].password;
    const isMatch = await bcrypt.compare(oldPassword, hashedPassword);
    if (!isMatch)
      return res.status(401).json({ success: false, message: "Incorrect old password" });

    res.status(200).json({ success: true, message: "Old password verified" });
  });
};

// Change Password
const changePassword = (req, res) => {
  const { email, newPassword } = req.body;

  bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
    if (err)
      return res.status(500).json({ success: false, message: "Password hashing failed" });

    const sql = "UPDATE users SET password = ? WHERE email = ?";
    db.query(sql, [hashedPassword, email], (err, result) => {
      if (err)
        return res.status(500).json({ success: false, message: "Database error" });

      if (result.affectedRows === 0)
        return res.status(404).json({ success: false, message: "User not found" });

      res.status(200).json({ success: true, message: "Password updated successfully" });
    });
  });
};

module.exports = { loginUser, verifyPassword, changePassword };
