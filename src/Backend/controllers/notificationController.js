const db = require("../db");

// Fetch all notifications for logged-in user
const getNotifications = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(400).json({ message: "User not authenticated" });

  const sql = `
    SELECT id, title, message, type, is_read, opened_by_user, read_by_user, created_at 
    FROM notifications 
    WHERE user_id = ? 
    ORDER BY created_at DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json(results);
  });
};

// Get unread or un-opened notifications (for showing popup again after login)
const getUnopenedNotification = (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(400).json({ message: "User not authenticated" });

  const sql = `
    SELECT * FROM notifications 
    WHERE user_id = ? AND opened_by_user = 0 
    ORDER BY created_at DESC 
    LIMIT 1
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ message: err.message });
    if (results.length === 0) return res.json(null);
    res.json(results[0]);
  });
};

// Mark notification as opened (when popup is shown)
const markAsOpened = (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(400).json({ message: "User not authenticated" });

  const sql = `
    UPDATE notifications 
    SET opened_by_user = 1 
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [id, userId], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification marked as opened" });
  });
};

// Mark as read (when user opens it from list)
const markAsRead = (req, res) => {
  const { id } = req.params;
  const userId = req.user?.id;
  if (!userId) return res.status(400).json({ message: "User not authenticated" });

  const sql = `
    UPDATE notifications 
    SET is_read = 1, read_by_user = 1, read_at = NOW() 
    WHERE id = ? AND user_id = ?
  `;

  db.query(sql, [id, userId], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification marked as read" });
  });
};

// Delete notification (for managers and above)
const deleteNotification = (req, res) => {
  const { id } = req.params;
  const { id: userId, role } = req.user || {};

  if (!role) return res.status(400).json({ message: "User role not found" });

  const allowedRoles = ["manager", "managing_director", "director", "superadmin"];
  if (!allowedRoles.includes(role.toLowerCase()))
    return res.status(403).json({ message: "Access denied" });

  db.query("DELETE FROM notifications WHERE id = ?", [id], (err, result) => {
    if (err) return res.status(500).json({ message: err.message });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification deleted successfully" });
  });
};

// Clear all notifications (Manager or above only)
const clearAllNotifications = (req, res) => {
  const { role } = req.user || {};

  if (!role) return res.status(400).json({ message: "User role not found" });

  const allowedRoles = ["manager", "managing_director", "director", "superadmin"];
  if (!allowedRoles.includes(role.toLowerCase()))
    return res.status(403).json({ message: "Access denied" });

  db.query("DELETE FROM notifications", (err) => {
    if (err) return res.status(500).json({ message: err.message });
    res.json({ message: "All notifications cleared" });
  });
};

module.exports = {
  getNotifications,
  getUnopenedNotification,
  markAsOpened,
  markAsRead,
  deleteNotification,
  clearAllNotifications,
};
