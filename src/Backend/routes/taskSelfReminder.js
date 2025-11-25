const express = require("express");
const router = express.Router();
const {getSelfReminder, saveSelfReminder } = require("../controllers/taskSelfReminderController");
const { verifyToken } = require("../middleware/authMiddleware");

// GET self reminder
router.get("/:taskId", verifyToken, getSelfReminder);

// SAVE / UPDATE
router.post("/save", verifyToken, saveSelfReminder);

module.exports = router;
