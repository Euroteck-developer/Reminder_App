const db = require("../db");
const nodemailer = require("nodemailer");
const cron = require("node-cron");

//  EMAIL
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: process.env.EMAIL_PORT,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
//   tls: { ciphers: "SSLv3" },
// });

const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  secure: false,
  auth: {
    user: "apikey",  // literally the word "apikey"
    pass: process.env.SENDGRID_API_KEY, // your actual API key
  },
});

const sendEmail = async (to, subject, html) => {
  return transporter.sendMail({
    from: "Reminder App <developer@euroteckindia.com>" ,
    // from: `"Task Reminder" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

//  Get Self reminders
const getSelfReminder = (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  const query = `
    SELECT id, reminder_datetime, sent
    FROM task_self_reminders
    WHERE task_id = ? AND user_id = ?
    LIMIT 1;
  `;

  db.query(query, [taskId, userId], (err, rows) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (rows.length === 0) return res.json(null);

    res.json(rows[0]);
  });
};

//  Cnoversion of Js date to db date & time
const toMySQLDate = (date) => {
  const d = new Date(date);
  const pad = (n) => (n < 10 ? "0" + n : n);

  return (
    d.getFullYear() +
    "-" +
    pad(d.getMonth() + 1) +
    "-" +
    pad(d.getDate()) +
    " " +
    pad(d.getHours()) +
    ":" +
    pad(d.getMinutes()) +
    ":" +
    pad(d.getSeconds())
  );
};

// Save & update of self reminder
const saveSelfReminder = (req, res) => {
  const { taskId, reminder_datetime } = req.body;
  const userId = req.user.id;

  if (!taskId || !reminder_datetime) {
    return res.status(400).json({ message: "Missing fields" });
  }

  const mysqlDate = toMySQLDate(reminder_datetime);

  const checkQuery = `
    SELECT id FROM task_self_reminders
    WHERE task_id = ? AND user_id = ?
    LIMIT 1;
  `;

  db.query(checkQuery, [taskId, userId], (err, rows) => {
    if (err) {
      console.error("Check Error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    // Update
    if (rows.length > 0) {
      const updateQuery = `
        UPDATE task_self_reminders
        SET reminder_datetime = ?, sent = 0
        WHERE id = ?;
      `;

      db.query(updateQuery, [mysqlDate, rows[0].id], (uErr) => {
        if (uErr) {
          console.error("Update Error:", uErr);
          return res.status(500).json({ message: "Error updating reminder" });
        }

        return res.json({ message: "Self reminder updated successfully" });
      });
      return;
    }

    // Insert
    const insertQuery = `
      INSERT INTO task_self_reminders (task_id, user_id, reminder_datetime, sent)
      VALUES (?, ?, ?, 0);
    `;

    db.query(insertQuery, [taskId, userId, mysqlDate], (iErr) => {
      if (iErr) {
        console.error("Insert Error:", iErr);
        return res.status(500).json({ message: "Error adding reminder" });
      }

      return res.json({ message: "Self reminder added successfully" });
    });
  });
};

// Check the status of pending or send in frontend we set to mark as read 
const markReminderSent = (reminderId) => {
  const q = `
    UPDATE task_self_reminders
    SET sent = 1
    WHERE id = ?
  `;
  db.query(q, [reminderId], (err) => {
    if (err) console.error("Cron Update Error:", err);
  });
};

//  Cron to get mail for scheduled time
cron.schedule("* * * * *", () => {
  // console.log("Checking self reminders...");

  const query = `
    SELECT 
      r.id, 
      r.task_id, 
      r.reminder_datetime,
      u.email,
      u.name AS username,
      t.description AS task_title
    FROM task_self_reminders r
    JOIN users u ON u.id = r.user_id
    JOIN task_reminders t ON t.id = r.task_id
    WHERE r.sent = 0
      AND r.reminder_datetime <= NOW();
  `;

  db.query(query, async (err, rows) => {
    if (err) {
      console.error("Cron Query Error:", err);
      return;
    }

    for (const r of rows) {
      try {
        // Format Task Title (40 chars)
        const cleanTitle = (r.task_title || "").trim();
        const shortTitle =
          cleanTitle.length > 40
            ? cleanTitle.substring(0, 40) + "..."
            : cleanTitle;

        // Email Template with Username
        const emailHtml = `
          <div style="font-family: Arial; padding: 20px; background: #f7f7f7">
            <div style="max-width: 600px; margin: auto; background: white; padding: 25px; border-radius: 10px;">
              
              <h2 style="color:#0052cc; text-align:center;">Task Reminder</h2>

              <p>Hello <strong>${r.username}</strong>,</p>
              <p>This is a reminder for your task:</p>

              <div style="padding: 15px; background: #eef4ff; border-left: 5px solid #0052cc; margin: 10px 0; border-radius: 5px;">
                <strong>${shortTitle}</strong>
              </div>

              <p><strong>Scheduled Reminder Time:</strong><br>${r.reminder_datetime}</p>

              <div style="text-align: center; margin-top: 25px;">
                <a href="${process.env.FRONTEND_URL}"
                  style="background:#0052cc;color:white;text-decoration:none;padding:12px 20px;border-radius:5px;font-size:16px;">
                  Login to View Task
                </a>
              </div>

              <p style="margin-top: 25px; color:#555;">Thank you,<br/>Task Management System</p>
            </div>
          </div>
        `;

        // Send Email
        await sendEmail(r.email, "Task Reminder", emailHtml);

        // Mark as sent
        markReminderSent(r.id);

        console.log(`Reminder Sent | User: ${r.email} | Name: ${r.username}`);

      } catch (e) {
        console.error("Email Send Error:", e);
      }
    }
  });
});


module.exports = {
  getSelfReminder,
  saveSelfReminder,
  markReminderSent,
};
