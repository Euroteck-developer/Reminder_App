const db = require("../db");
const nodemailer = require("nodemailer");

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
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 10000, // optional: 10s timeout
});


// Schedule a new meeting
const scheduleMeeting = (req, res) => {
  const { description, date, priority, users = [], departments = [], createdBy } = req.body;

  if (!description || !date || !createdBy || (!users.length && !departments.length)) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const insertMeetingQuery = `
    INSERT INTO meetings (description, date, priority, created_by, status)
    VALUES (?, ?, ?, ?, 'Pending')
  `;

  db.query(insertMeetingQuery, [description, date, priority, createdBy], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const meetingId = result.insertId;

    // Insert assigned users
    if (users.length > 0) {
      const userValues = users.map(u => [meetingId, u]);
      db.query("INSERT INTO meeting_assignees (meeting_id, user_id) VALUES ?", [userValues], err2 => {
        if (err2) console.error("User assignment failed:", err2.message);
      });
    }

    // Insert assigned departments
    if (departments.length > 0) {
      const deptValues = departments.map(d => [meetingId, d]);
      db.query("INSERT INTO meeting_departments (meeting_id, department_id) VALUES ?", [deptValues], err3 => {
        if (err3) console.error("Department assignment failed:", err3.message);
      });
    }

    // Prepare notifications
    const notifValues = [];

    if (users.length > 0) {
      users.forEach(u => {
        notifValues.push([
          u,
          "New Meeting Scheduled",
          `A new meeting has been scheduled: ${description}`,
          "Meeting",
        ]);
      });
    }

    // Function to send notifications + emails after dept users are added
    const finalizeNotificationsAndEmails = (extraUsers = []) => {
      extraUsers.forEach(u => {
        notifValues.push([
          u,
          "New Meeting Scheduled",
          `A new meeting has been scheduled: ${description}`,
          "Meeting",
        ]);
      });

      // Insert notifications
      if (notifValues.length > 0) {
        db.query(
          "INSERT INTO notifications (user_id, title, message, type) VALUES ?",
          [notifValues],
          (errNotif) => {
            if (errNotif) console.error("Error inserting notifications:", errNotif.message);
          }
        );
      }

      // Build recipient query
      const conditions = [];
      if (users.length > 0) conditions.push(`id IN (${users.join(",")})`);
      if (departments.length > 0) conditions.push(`dept_id IN (${departments.join(",")})`);

      if (conditions.length === 0) {
        return res.json({ message: "Meeting scheduled, but no recipients found" });
      }

      const userQuery = `SELECT email, name FROM users WHERE ${conditions.join(" OR ")}`;

      db.query(userQuery, (err4, recipients) => {
        if (err4) return res.status(500).json({ error: err4.message });

        if (!recipients || recipients.length === 0) {
          return res.json({ message: "Meeting scheduled but no user emails found" });
        }

        // Send emails
        recipients.forEach(user => {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: user.email,
            subject: `New Meeting Scheduled`,
            html: `
              <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                <h3 style="color: #004aad;">Hello ${user.name},</h3>
                <p>A new meeting has been scheduled:</p>
                <ul>
                  <li><strong>Description:</strong> ${description}</li>
                  <li><strong>Date & Time:</strong> ${new Date(date).toLocaleString()}</li>
                  <li><strong>Priority:</strong> ${priority}</li>
                </ul>
                <p>Please click the button below to view meeting details:</p>
                <div style="text-align: center; margin-top: 20px;">
                  <a href="${process.env.FRONTEND_URL}/login"
                    style="
                      background-color: #007bff;
                      color: white;
                      padding: 12px 20px;
                      text-decoration: none;
                      border-radius: 6px;
                      font-weight: bold;
                      display: inline-block;
                    ">
                     Login to Dashboard
                  </a>
                </div>
                <p style="margin-top: 30px; font-size: 13px; color: #555;">
                  This is an automated message. Please do not reply.
                </p>
              </div>
            `,
          };

          transporter.sendMail(mailOptions, errMail => {
            if (errMail)
              console.error(` Email to ${user.email} failed:`, errMail.message);
            else
              console.log(` Email sent to ${user.email}`);
          });
        });

        res.json({
          message: "Meeting scheduled successfully and emails sent",
          meetingId,
          notifiedUsers: recipients.length,
        });
      });
    };

    // Add dept users if departments were selected
    if (departments.length > 0) {
      const deptQuery = `SELECT id FROM users WHERE dept_id IN (${departments.join(",")})`;
      db.query(deptQuery, (errDept, deptUsers) => {
        if (!errDept && deptUsers.length > 0) {
          const extraUserIds = deptUsers.map(u => u.id);
          finalizeNotificationsAndEmails(extraUserIds);
        } else {
          finalizeNotificationsAndEmails([]);
        }
      });
    } else {
      // No departments — send only to selected users
      finalizeNotificationsAndEmails([]);
    }
  });
};

// Get all meetings with details
const getAllMeetings = (req, res) => {
  const userId = req.user?.id;
  const userRole = req.user?.role?.toLowerCase();

  const adminRoles = ["superadmin", "managing_director", "director"];

  let baseQuery = `
    SELECT 
      m.id, m.description, m.date, m.priority, m.status,
      u.id AS created_by_id, u.name AS created_by_name, u.email AS created_by_email
    FROM meetings m
    JOIN users u ON m.created_by = u.id
  `;

  let conditions = [];
  let params = [];

  if (!adminRoles.includes(userRole)) {
    baseQuery += `
      LEFT JOIN meeting_assignees ma ON m.id = ma.meeting_id
      LEFT JOIN meeting_departments md ON m.id = md.meeting_id
      LEFT JOIN departments d ON md.department_id = d.id
    `;

    conditions.push(`
      (m.created_by = ? 
      OR ma.user_id = ? 
      OR d.id = (SELECT dept_id FROM users WHERE id = ?))
    `);
    params.push(userId, userId, userId);
  }

  const finalQuery =
    baseQuery +
    (conditions.length ? ` WHERE ${conditions.join(" OR ")}` : "") +
    " GROUP BY m.id ORDER BY m.date DESC";

  db.query(finalQuery, params, (err, meetings) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!meetings.length) {
      // Always return consistent structure
      return res.status(200).json({
        message: "No meetings have been created for your email or department.",
        meetings: [],
      });
    }

    const meetingIds = meetings.map((m) => m.id);

    const usersQuery = `
      SELECT ma.meeting_id, u.id AS user_id, u.name, u.email
      FROM meeting_assignees ma
      JOIN users u ON ma.user_id = u.id
      WHERE ma.meeting_id IN (?)
    `;

    const deptQuery = `
      SELECT md.meeting_id, d.id AS dept_id, d.name AS dept_name
      FROM meeting_departments md
      JOIN departments d ON md.department_id = d.id
      WHERE md.meeting_id IN (?)
    `;

    db.query(usersQuery, [meetingIds], (err2, assignedUsers) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.query(deptQuery, [meetingIds], (err3, meetingDepts) => {
        if (err3) return res.status(500).json({ error: err3.message });

        const meetingsFull = meetings.map((m) => ({
          ...m,
          created_by: {
            id: m.created_by_id,
            name: m.created_by_name,
            email: m.created_by_email,
          },
          users: assignedUsers.filter((u) => u.meeting_id === m.id),
          departments: meetingDepts
            .filter((d) => d.meeting_id === m.id)
            .map((d) => d.dept_name),
        }));

        res.json({
          message: "Meetings fetched successfully",
          meetings: meetingsFull,
        });
      });
    });
  });
};

// Update meeting status
const updateMeetingStatus = (req, res) => {
  const { meetingId, status } = req.body;
  const userId = req.user.id; // logged in user

  if (!meetingId || !status)
    return res.status(400).json({ message: "Meeting ID and status are required" });

  const validStatuses = ["Pending", "Completed", "Cancelled"];
  if (!validStatuses.includes(status))
    return res.status(400).json({ message: "Invalid status value" });

  // Check if user is the creator
  const checkQuery = "SELECT created_by FROM meetings WHERE id = ?";
  db.query(checkQuery, [meetingId], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    if (rows.length === 0) return res.status(404).json({ message: "Meeting not found" });

    if (Number(rows[0].created_by) !== Number(userId)) {
      return res.status(403).json({
        message: "Only the creator can update the meeting status",
      });
    }

    // update
    const updateQuery = "UPDATE meetings SET status = ? WHERE id = ?";
    db.query(updateQuery, [status, meetingId], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json({ message: `Meeting status updated to '${status}'` });
    });
  });
};


//Delete meeting(only the creator can be deleted)
const deleteMeeting = (req, res) => {
  const userId = req.user?.id; // Logged-in user
  const { meetingId } = req.params;

  if (!meetingId)
    return res.status(400).json({ message: "Meeting ID is required" });

  // Step 1: Verify meeting exists and user is creator
  const checkQuery = "SELECT created_by FROM meetings WHERE id = ?";
  db.query(checkQuery, [meetingId], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!result.length)
      return res.status(404).json({ message: "Meeting not found" });

    const creatorId = result[0].created_by;
    if (creatorId !== userId)
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this meeting" });

    // Step 2: Delete related records first (foreign key dependencies)
    const deleteAssignees = "DELETE FROM meeting_assignees WHERE meeting_id = ?";
    const deleteDepts = "DELETE FROM meeting_departments WHERE meeting_id = ?";
    const deleteNotif = "DELETE FROM notifications WHERE message LIKE ?";

    db.query(deleteAssignees, [meetingId]);
    db.query(deleteDepts, [meetingId]);
    db.query(deleteNotif, [`%Meeting ID: ${meetingId}%`]);

    // Step 3: Delete meeting
    const deleteMeetingQuery = "DELETE FROM meetings WHERE id = ?";
    db.query(deleteMeetingQuery, [meetingId], (err2, result2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      if (result2.affectedRows === 0)
        return res.status(404).json({ message: "Meeting not found" });

      res.json({ message: "Meeting deleted successfully" });
    });
  });
};


module.exports = { scheduleMeeting, getAllMeetings,
  updateMeetingStatus, deleteMeeting };
