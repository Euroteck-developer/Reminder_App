const express = require("express");
const router = express.Router();
const {
  getNotifications,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
  getUnopenedNotification, 
  markAsOpened,
} = require("../controllers/notificationController");

const { verifyToken } = require("../middleware/authMiddleware");

// Fetch all notifications for the logged-in user
router.get("/", verifyToken, getNotifications);

// Mark notification as read
router.put("/:id/read", verifyToken, markAsRead);

// Delete a single notification (Manager or above)
router.delete("/:id", verifyToken, deleteNotification);

// Clear all notifications (Manager or above)
router.delete("/clear", verifyToken, clearAllNotifications);

//  Fetch last unopened popup (for login restore)
router.get("/unopened", verifyToken, getUnopenedNotification);

//  Mark popup as opened
router.patch("/:id/opened", verifyToken, markAsOpened);

module.exports = router;
