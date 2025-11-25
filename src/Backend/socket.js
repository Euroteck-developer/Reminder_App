const db = require("./db");

const setupSocket = (io) => {
  io.on("connection", (socket) => {
    console.log("New socket connected:", socket.id);

    // Step 1: User joins their room
    socket.on("joinUserRoom", (userId) => {
      if (!userId) return;
      socket.join(`user_${userId}`);
      console.log(` User ${userId} joined room user_${userId}`);

      // Step 2: Wait a moment before sending missed notifications
      setTimeout(() => {
        const query = `
          SELECT id, title, message, type, task_id
          FROM notifications 
          WHERE user_id = ? AND is_read = 0
        `;

        db.query(query, [userId], (err, results) => {
          if (err) {
            console.error(" Error fetching offline notifications:", err);
            return;
          }

          if (results.length > 0) {
            console.log(`Sending ${results.length} missed notifications to user ${userId}`);

            // Step 3: Send all missed notifications to the user's room
            results.forEach((notif) => {
              io.to(`user_${userId}`).emit("newNotification", notif);
            });

            // Step 4: Optionally mark them as read after sending
            const ids = results.map((n) => n.id);
            db.query("UPDATE notifications SET is_read = 1 WHERE id IN (?)", [ids], (updateErr) => {
              if (updateErr) console.error(" Error marking notifications read:", updateErr);
            });
          }
        });
      }, 500); // small delay ensures room is joined before sending
    });

    socket.on("disconnect", () => {
      console.log(" Socket disconnected:", socket.id);
    });
  });
};

module.exports = setupSocket;
