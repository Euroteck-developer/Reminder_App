const db = require("../db");
const nodemailer = require("nodemailer");

// Configure mail transporter
// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: process.env.EMAIL_PORT,
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS,
//   },
//   tls: {
//     ciphers: "SSLv3"
//   }
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

//Helper to send emails
const getEmailTemplate = (themeColor, title, message, displayName, taskName, btnLink, extra = "") => `
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:30px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:Segoe UI, Arial, sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <tr>
          <td style="background-color:${themeColor};color:#ffffff;padding:20px;text-align:center;font-size:22px;font-weight:bold;">
            Reminder App
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:30px 40px;color:#333333;">
            <h2 style="font-size:18px;margin-bottom:15px;color:#111827;">${title}</h2>
            <p style="font-size:15px;line-height:1.6;color:#444444;margin-bottom:10px;">
              ${message}
            </p>
            ${
              taskName
                ? `<p style="font-size:14px;color:#555;margin:5px 0;">
                    <strong>Task:</strong> ${truncateText(taskName)}
                  </p>`
                : ""
            }
            ${
              displayName
                ? `<p style="font-size:14px;color:#555;margin:5px 0;">
                    <strong>Updated by:</strong> ${displayName}
                  </p>`
                : ""
            }

            ${extra}

            <!-- CTA Button -->
            ${
              btnLink
                ? `
            <div style="text-align:center;margin-top:30px;">
              <a href="${btnLink}" target="_blank" 
                style="background-color:${themeColor};
                color:#ffffff;
                text-decoration:none;
                padding:12px 25px;
                border-radius:6px;
                font-size:15px;
                display:inline-block;">
                Login to Dashboard
              </a>
            </div>` : ""
            }
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background-color:#f3f4f6;text-align:center;padding:15px;">
            <p style="color:#6b7280;font-size:13px;margin:0;">© 2025 TaskFlow PMS. All rights reserved.</p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
`;

// Define this helper first
const truncateText = (text = "", limit = 20) =>
  text.length > limit ? text.substring(0, limit).trim() + "..." : text;

// Then define sendMail
const sendMail = (to, subject, type, title, message, displayName, taskName, btnLink, extra = "") => {
  const colors = {
    assigned: "#22C55E",
    updated: "#2563EB",
    removed: "#DC2626",
    reassigned: "#9333EA",
    default: "#4F46E5",
  };

  const themeColor = colors[type] || colors.default;
  const truncatedTaskName = truncateText(taskName || "Task", 20);
  const html = getEmailTemplate(themeColor, title, message, displayName, truncatedTaskName, btnLink, extra);

  const mailOptions = {
    from: "Reminder App <developer@euroteckindia.com>" ,
    // from: `"Reminder App" <${process.env.EMAIL_USER}>`,
    to,
    subject: `${subject}`,
    html,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error(` Email error for ${to}:`, err.message);
    } else {
      console.log(` Email sent successfully to ${to}: ${info.response}`);
    }
  });
};

// Send Task Reminder
const sendReminder = (req, res) => {
  const io = req.app.get("io");
  const { description, users, assignedDate, dueDate, priority, createdBy } = req.body;

  if (!description || !users?.length || !assignedDate || !dueDate || !createdBy) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  const assigned = new Date(assignedDate);
  const due = new Date(dueDate);

  const insertTaskQuery = `
    INSERT INTO task_reminders (description, priority, assigned_date, due_date, created_by)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(insertTaskQuery, [description, priority || "Medium", assigned, due, createdBy], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    const reminderId = result.insertId;

    // Insert assigned users
    const values = users.map((u) => [reminderId, u]);
    db.query("INSERT INTO task_assignees (task_id, user_id) VALUES ?", [values], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });

      // Insert notifications
      const notifValues = [
        ...users.map((u) => [
          u,
          "New Task Assigned",
          `You have been assigned a new task: ${description}`,
          "Task",
          reminderId,
        ]),
        [
          createdBy,
          "Task Assigned Successfully",
          `You have assigned "${description}" to ${users.length} user(s)`,
          "Task",
          reminderId,
        ],
      ];

      db.query(
        "INSERT INTO notifications (user_id, title, message, type, task_id) VALUES ?",
        [notifValues],
        (errNotif) => {
          if (errNotif) console.error(" Notification insert error:", errNotif);
        }
      );

      // Send socket popups
      const sendPopup = (userId, title, message) =>
        io.to(`user_${userId}`).emit("newNotification", { title, message, taskId: reminderId });

      users.forEach((u) =>
        sendPopup(u, "New Task Assigned", `You have been assigned a new task: ${description}`)
      );
      sendPopup(
        createdBy,
        "Task Assigned Successfully",
        `You have assigned "${description}" to ${users.length} user(s).`
      );

      // Respond immediately
      res.json({
        success: true,
        message: `Task successfully assigned to ${users.length} user(s).`,
        taskId: reminderId,
      });

      // Background email send (non-blocking)
      const userQuery = `SELECT name, email FROM users WHERE id IN (?)`;
      db.query(userQuery, [users], (err3, assignedUsers) => {
        if (err3) return console.error(" Error fetching emails:", err3);
        
        assignedUsers.forEach((user) => {
          const html = `
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa;padding:30px 0;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.05);">
          
                  <!-- Header -->
                  <tr>
                    <td style="background-color:#22C55E;color:#ffffff;padding:20px;text-align:center;font-size:22px;font-weight:bold;">
                      Reminder App
                    </td>
                  </tr>
                  
                  <!-- Body -->
                  <tr>
                    <td style="padding:30px 40px;color:#333333;">
                      <h2 style="font-size:20px;margin-bottom:15px;color:#111827;">New Task Assigned</h2>
              
                      <p style="font-size:15px;line-height:1.6;color:#444444;margin-bottom:10px;">
                        Hello <strong>${user.name}</strong>,
                      </p>
                      <p style="font-size:15px;line-height:1.6;color:#444444;margin-bottom:15px;">
                        You have been assigned a new task. Kindly review the details below and proceed accordingly.
                      </p>
                      
                      <table cellpadding="6" cellspacing="0" width="100%" style="border-collapse:collapse;font-size:14px;margin:15px 0;">
                        <tr style="background-color:#f9fafb;">
                          <td style="width:150px;font-weight:600;color:#111827;">Task</td>
                          <td style="color:#374151;">${truncateText(description)}</td>
                        </tr>
                        <tr>
                          <td style="font-weight:600;color:#111827;">Priority</td>
                          <td style="color:#374151;">${priority}</td>
                        </tr>
                        <tr style="background-color:#f9fafb;">
                          <td style="font-weight:600;color:#111827;">Assigned Date</td>
                          <td style="color:#374151;">${assigned.toLocaleString()}</td>
                        </tr>
                        <tr>
                          <td style="font-weight:600;color:#111827;">Due Date</td>
                          <td style="color:#374151;">${due.toLocaleString()}</td>
                        </tr>
                      </table>
                      
                      <!-- CTA Button -->
                      <div style="text-align:center;margin-top:25px;">
                        <a href="${process.env.FRONTEND_URL}"
                          style="background-color:#22C55E;
                          color:#ffffff;
                          text-decoration:none;
                          padding:12px 25px;
                          border-radius:6px;
                         font-size:15px;
                         display:inline-block;
                         font-weight:500;">
                         View Task in Dashboard
                        </a>
                      </div>

                      <p style="margin-top:30px;font-size:14px;color:#555;">
                        Please ensure to complete the task by the mentioned due date.  
                        If you have any questions, feel free to contact your manager.
                      </p>

                      <p style="font-size:14px;color:#555;margin-top:25px;">
                        Regards,<br/>
                        <strong>TaskFlow PMS Team</strong>
                      </p>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="background-color:#f3f4f6;text-align:center;padding:15px;">
                      <p style="color:#6b7280;font-size:13px;margin:0;">© 2025 TaskFlow PMS. All rights reserved.</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
         `;
         
         const mailOptions = {
          from: "Reminder App <developer@euroteckindia.com>" ,
          // from: `"TaskFlow PMS" <${process.env.EMAIL_USER}>`,
          to: user.email,
          subject: "New Task Assigned",
          html,
         };
         transporter.sendMail(mailOptions, (errMail) => {
          if (errMail) console.error(` Email error for ${user.email}:`, errMail);
        });
      });
     });
    });
  });
};

// Get all tasks
const getAllTasks = (req, res) => {
  const userId = req.user.id;
  const roleId = req.user.role_id;

  // These roles can see ALL tasks
  const rolesWithAllAccess = [1, 2, 3];

  let sql = `
    SELECT 
      tr.id,
      tr.description AS task,
      tr.priority,
      tr.assigned_date,
      tr.due_date,
      tr.extended_due_date,
      tr.status,
      tr.status_desc,
      tr.last_updated,
      tr.last_updated_by,
      tr.created_by,
      u1.name AS created_by_name,
      lu.name AS last_updated_by_name
    FROM task_reminders tr
    JOIN users u1 ON tr.created_by = u1.id
    LEFT JOIN users lu ON tr.last_updated_by = lu.id
  `;

  // Non-admin users see only created or assigned tasks
  if (!rolesWithAllAccess.includes(roleId)) {
    sql += `
      WHERE tr.created_by = ? 
      OR tr.id IN (
        SELECT ta.task_id FROM task_assignees ta WHERE ta.user_id = ?
      )
    `;
  }

  sql += " ORDER BY tr.due_date DESC";

  db.query(
    sql,
    rolesWithAllAccess.includes(roleId) ? [] : [userId, userId],
    (err, tasks) => {
      if (err) return res.status(500).json({ message: "DB error", err });

      if (tasks.length === 0) return res.json([]);

      const taskIds = tasks.map((t) => t.id);

      const assigneesSql = `
        SELECT ta.task_id, u.id AS user_id, u.name 
        FROM task_assignees ta
        JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id IN (?)
      `;

      db.query(assigneesSql, [taskIds], (err2, assignees) => {
        if (err2) return res.status(500).json({ message: "DB error", err2 });

        const tasksWithUsers = tasks.map((task) => ({
          ...task,
          created_by_id: task.created_by,
          created_by: { id: task.created_by, name: task.created_by_name },
          last_updated_by: {
            id: task.last_updated_by,
            name: task.last_updated_by_name,
          },
          users: assignees
            .filter((a) => a.task_id === task.id)
            .map((a) => ({ id: a.user_id, name: a.name })),
        }));

        res.json(tasksWithUsers);
      });
    }
  );
};

// Update Task and Track History
const updateTaskStatus = (req, res) => {
  const userId = req.user.id;
  const roleId = req.user.role_id;
  const { taskId, status, statusDesc, extendedDue, assignedTo } = req.body;

  if (!taskId) return res.status(400).json({ message: "Missing taskId" });

  const managerOrAbove = [1, 2, 3, 4].includes(roleId);

  // Step 1 — Check permission
  const checkQuery = `SELECT * FROM task_assignees WHERE task_id=? AND user_id=?`;
  db.query(checkQuery, [taskId, userId], (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (!managerOrAbove && results.length === 0)
      return res.status(403).json({ message: "You are not assigned to this task" });

    // Step 2 — Prepare fields for update
    const fields = [];
    const values = [];

    if (status) {
      fields.push("status=?");
      values.push(status);
    }
    if (statusDesc) {
      fields.push("status_desc=?");
      values.push(statusDesc);
    }
    if (managerOrAbove && extendedDue) {
      fields.push("extended_due_date=?");
      values.push(extendedDue);
    }

    fields.push("last_updated=NOW()", "last_updated_by=?");
    values.push(userId, taskId);

    // Step 3 — Update task_reminders
    db.query(`UPDATE task_reminders SET ${fields.join(",")} WHERE id=?`, values, (err2) => {
      if (err2) return res.status(500).json({ message: "DB error updating task" });
      // Handle statusDesc-based email
      if (status || statusDesc) {
        const infoQuery = `
          SELECT 
          LEFT(t.description, 40) AS task_name,
          u.name AS changer_name,
          t.created_by
          FROM task_reminders t
          JOIN users u ON u.id = ?
          WHERE t.id = ?;
        `;

        db.query(infoQuery, [userId, taskId], (errInfo, infoRows) => {
          if (errInfo || !infoRows.length) {
            console.error(" Error fetching task info:", errInfo);
            return;
          }
          
          const { task_name, changer_name, created_by } = infoRows[0];

          const recipientQuery = managerOrAbove
            ? `SELECT u.email, u.name 
              FROM task_assignees ta 
              JOIN users u ON ta.user_id = u.id
              WHERE ta.task_id = ?`
            : `SELECT email, name FROM users WHERE id = ?`;

          const params = managerOrAbove ? [taskId] : [created_by];

          db.query(recipientQuery, params, (errMail, recRows) => {
            if (errMail || !recRows.length) {
              console.error(" No recipients found:", errMail);
              return;
            }
            
            const emails = recRows.map((r) => r.email).join(",");
            const namesList = recRows.map((r) => r.name).join(", ");

            const subject = "Update on task status";
            const title = "Task Update Notification";
            
            const extra = `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:15px;">
                <tr>
                  <td style="
                    padding:12px 16px;
                    border-left:4px solid ${
                      status === "Completed"
                      ? "#28a745"
                      : status === "Pending"
                      ? "#ffc107"
                      : "#0078D7"
                    };
                    background:${
                      status === "Completed"
                      ? "#e8f6ee"
                      : status === "Pending"
                      ? "#fff8e5"
                      : "#f4f9ff"
                    };
                    border-radius:6px;
                    font-size:14px;
                    color:#333;
                  ">
                    <strong>Status:</strong> ${status || "Updated"}<br>
                   ${statusDesc ? `<strong>Description:</strong> ${statusDesc}` : ""}
                  </td>
                </tr>
              </table>
            `;

            const message = `
              <p>Recipients: ${namesList}</p>
            `;

            sendMail(
              emails,
              subject,
              "status-update",
              title,
              message,
              changer_name,
              task_name,
              `${process.env.FRONTEND_URL}`,
              extra
            );
          });
        });
      }

      // Step 4 — Handle assignee updates only if manager or above
      if (managerOrAbove && Array.isArray(assignedTo)) {
        const getOld = `SELECT user_id FROM task_assignees WHERE task_id=?`;
        db.query(getOld, [taskId], (errOld, oldRows) => {
          if (errOld)
            return res.status(500).json({ message: "Error fetching assignees" });

          const oldIds = oldRows.map((r) => r.user_id);
          const newIds = assignedTo.map((id) => Number(id));

          const toAdd = newIds.filter((id) => !oldIds.includes(id)); // Newly added
          const toRemove = oldIds.filter((id) => !newIds.includes(id)); // Lost
          const still = oldIds.filter((id) => newIds.includes(id)); // Old (retained)

          // If no change, skip
          if (toAdd.length === 0 && toRemove.length === 0) {
            console.log("No assignee changes");
            return fetchUpdatedTask();
          }

          // Step 5 — Remove unassigned users
          if (toRemove.length) {
            const placeholders = toRemove.map(() => "?").join(",");
            db.query(
              `DELETE FROM task_assignees WHERE task_id=? AND user_id IN (${placeholders})`,
              [taskId, ...toRemove],
              (errDel) => {
                if (errDel)
                  return res.status(500).json({ message: "Error removing assignees" });
                addNewAssignees();
              }
            );
          } else {
            addNewAssignees();
          }

          // Step 6 — Add new assignees
          function addNewAssignees() {
            if (!toAdd.length) {
              recordHistory(taskId, userId, [], still, toRemove);
              return;
            }

            const vals = toAdd.map((uid) => [taskId, uid, userId, new Date()]);
            db.query(
              `INSERT INTO task_assignees (task_id, user_id, assigned_by, assigned_at) VALUES ?`,
              [vals],
              (errAdd) => {
                if (errAdd)
                  return res.status(500).json({ message: "Error adding assignees" });
                recordHistory(taskId, userId, toAdd, still, toRemove);
              }
            );
          }
        });
      } else fetchUpdatedTask();
    });
  });
  
  // Step 7 — Record Task History
  function recordHistory(taskId, changerId, newUsers, oldUsers, lostUsers) {
    if (!taskId) return;
    // Always check for reactivated even if no new users
    if (newUsers.length) {
      checkReactivated();
    } else {
    // Even if no new users, we may still have lost ones
    proceedWithInsert([], oldUsers, lostUsers, []);
  }
  
  function checkReactivated() {
    const placeholders = newUsers.map(() => "?").join(",");
    const checkLostQuery = `
      SELECT user_id 
      FROM task_history 
      WHERE task_id=? 
      AND user_id IN (${placeholders}) 
      AND status='Lost'
      GROUP BY user_id
    `;

    db.query(checkLostQuery, [taskId, ...newUsers], (err, lostPreviously) => {
      if (err) {
        console.error(" Error checking previous lost users:", err);
        return proceedWithInsert(newUsers, oldUsers, lostUsers, []); // fallback
      }

      const previouslyLostIds = lostPreviously.map((r) => r.user_id);
      const reactivated = newUsers.filter((u) => previouslyLostIds.includes(u)); // reassigned users
      const trulyNew = newUsers.filter((u) => !previouslyLostIds.includes(u));
 
      proceedWithInsert(trulyNew, oldUsers, lostUsers, reactivated);
    });
  }

  // Updated function
  function proceedWithInsert(newlyAdded, oldUsers, lostUsers, reactivatedUsers) {
    const data = [];

    if (newlyAdded.length)
      newlyAdded.forEach((u) => data.push([taskId, u, "New", changerId]));

    if (oldUsers.length)
      oldUsers.forEach((u) => data.push([taskId, u, "Old", changerId]));

    if (lostUsers.length)
      lostUsers.forEach((u) => data.push([taskId, u, "Lost", changerId]));

    if (reactivatedUsers.length)
      reactivatedUsers.forEach((u) => data.push([taskId, u, "Reassigned", changerId])); // add as 'Reassigned'

    if (!data.length) return fetchUpdatedTask();

    // Insert into history table
    db.query(
      `INSERT INTO task_history (task_id, user_id, status, changed_by) VALUES ?`,
      [data],
      (err) => {
        if (err) console.error(" Error inserting task history:", err);
        sendSocketUpdates(taskId, newlyAdded, oldUsers, reactivatedUsers, lostUsers, changerId);
        fetchUpdatedTask();
      }
    );
  }
}

  // Step 8 — Socket events  
function sendSocketUpdates(taskId, newUsers, oldUsers, reactivatedUsers, lostUsers, changerId) {
  //  Fetch task and changer info first (from task_reminders)
  const taskQuery = `
    SELECT 
      LEFT(t.description, 40) AS task_name,  -- first 40 chars of description
      u.name AS changer_name
    FROM task_reminders t
    JOIN users u ON u.id = ?
    WHERE t.id = ?;
  `;

  db.query(taskQuery, [changerId, taskId], (err, taskResult) => {
    if (err || !taskResult.length) {
      console.error("Task fetch error:", err);
      return;
    }

    const { task_name, changer_name } = taskResult[0];

    // Helper for sending mail to multiple users
    const sendAssigneeMail = (userIds, subject, type, title, message, extraInfo) => {
      if (!userIds || !userIds.length) return;

      const placeholders = userIds.map(() => "?").join(",");
      const sql = `SELECT email, name FROM users WHERE id IN (${placeholders})`;

      db.query(sql, userIds, (err, rows) => {
        if (err || !rows.length) return;

        const emails = rows.map(r => r.email).join(",");
        const displayNames = rows.map(r => r.name).join(", ");

        const extra = `
          <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-top:10px;">
            <tr><td><strong>Task:</strong></td><td>${truncateText(task_name)}</td></tr>
            <tr><td><strong>Members:</strong></td><td>${displayNames}</td></tr>
          </table>
          ${extraInfo}
        `;

        sendMail(
          emails,
          subject,
          type,
          title,
          message,
          changer_name,
          task_name,     
          `${process.env.FRONTEND_URL}`,
          extra
        );
      });
    };

    // New Assignees
    sendAssigneeMail(
      newUsers,
      "New Task Assigned",
      "assigned",
      "New Task Assignment",
      "You have been assigned a new task.Check below for more details.",
      `<p>Please log in to your dashboard to review details and start working.</p>`
    );

    // Reassigned Users
    sendAssigneeMail(
      reactivatedUsers,
      "Task Reassigned",
      "reassigned",
      "Task Reactivation Notice",
      "You have been reassigned to below task.",
      `<p>Welcome back! Please review any new updates added since your last assignment.</p>`
    );

    // Lost Users (Removed)
    sendAssigneeMail(
      lostUsers,
      "Task Unassigned",
      "removed",
      "Task Unassignment Notice",
      "You have been removed from below task.",
      `<p>If you believe this is a mistake, please contact your project manager.This result will be added in your overall performance.</p>`
    );
  });
}

  // Step 9 — Fetch updated task for response
  function fetchUpdatedTask() {
    const q = `
      SELECT tr.*, u.name AS created_by_name,
      JSON_ARRAYAGG(JSON_OBJECT('id', a.user_id, 'name', au.name)) AS users
      FROM task_reminders tr
      JOIN users u ON tr.created_by=u.id
      LEFT JOIN task_assignees a ON tr.id=a.task_id
      LEFT JOIN users au ON a.user_id=au.id
      WHERE tr.id=? GROUP BY tr.id
    `;

    db.query(q, [taskId], (err, rows) => {
      if (err)
        return res.status(500).json({ message: "DB error fetching updated task" });
      if (!rows.length)
        return res.status(404).json({ message: "Task not found" });

      const task = rows[0];
      try {
        task.users = typeof task.users === "string" ? JSON.parse(task.users) : task.users;
      } catch {
        task.users = [];
      }

      res.json({ success: true, message: "Task updated successfully", task });
    });
  }
};

// Get Task History
const getTaskHistory = (req, res) => {
  const userId = req.user.id;

  const q = `
    SELECT th.*, 
           tr.description AS task_description,
           tr.priority,
           u.name AS user_name, 
           cb.name AS changed_by_name
    FROM task_history th
    JOIN task_reminders tr ON tr.id = th.task_id
    LEFT JOIN users u ON u.id = th.user_id
    LEFT JOIN users cb ON cb.id = th.changed_by
    WHERE th.user_id = ? OR th.changed_by = ?
    ORDER BY th.changed_at DESC
  `;

  db.query(q, [userId, userId], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "DB error fetching user task history" });
    }

    res.json({
      success: true,
      total: results.length,
      data: results,
    });
  });
};

// Fetch single task by ID
const getTaskById = (req, res) => {
  const { id } = req.params;

  // Get task details + creator name
  const taskQuery = `
    SELECT 
      tr.*, 
      u.name AS created_by_name
    FROM task_reminders tr
    LEFT JOIN users u ON tr.created_by = u.id
    WHERE tr.id = ?;
  `;

  db.query(taskQuery, [id], (err, taskResults) => {
    if (err) return res.status(500).json({ message: "Database error", err });
    if (taskResults.length === 0)
      return res.status(404).json({ message: "Task not found" });

    const task = taskResults[0];

    // Get current assigned users with names & emails
    const assignedQuery = `
      SELECT 
        ta.id AS assignee_id,
        ta.task_id,
        ta.user_id,
        u.name AS user_name,
        u.email AS user_email,
        ta.assigned_by
      FROM task_assignees ta
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?;
    `;

    db.query(assignedQuery, [id], (aErr, assignedRows) => {
      if (aErr)
        return res.status(500).json({ message: "Error fetching assigned users" });

      // Extract previously assigned (distinct names)
      const prevAssignedQuery = `
        SELECT DISTINCT u.name AS user_name, u.email AS user_email
        FROM task_assignees ta
        LEFT JOIN users u ON ta.user_id = u.id
        WHERE ta.task_id = ?;
      `;
      db.query(prevAssignedQuery, [id], (pErr, prevRows) => {
        if (pErr)
          return res
            .status(500)
            .json({ message: "Error fetching previous assignees" });

        res.json({
          ...task,
          assigned_users: assignedRows, // current assigned
          previously_assigned: prevRows, // all who were ever assigned
        });
      });
    });
  });
};

//Adding task to History
const addTaskHistory = (req, res) => {
  const { taskId } = req.params;
  const { user_id, status, changed_by } = req.body;

  if (!taskId || !user_id || !status || !changed_by) {
    return res.status(400).json({
      success: false,
      message: "taskId, user_id, status, and changed_by are required",
    });
  }

  // Step 1: Check if user was previously marked Lost for this task
  const checkQuery = `
    SELECT id, status 
    FROM task_history 
    WHERE task_id = ? AND user_id = ?
    ORDER BY changed_at DESC
    LIMIT 1
  `;

  db.query(checkQuery, [taskId, user_id], (err, rows) => {
    if (err) {
      console.error(" Error checking task history:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error checking task history" });
    }

    const lastStatus = rows[0]?.status || null;

    //  Step 2: Logic — if user was lost and is being re-added → mark as "Reactivated"
    let finalStatus = status;
    if (lastStatus === "Lost" && status === "New") {
      finalStatus = "Reactivated"; // optional alias for clarity
    }

    //  Step 3: Insert new history record
    const insertQuery = `
      INSERT INTO task_history (task_id, user_id, status, changed_by, changed_at)
      VALUES (?, ?, ?, ?, NOW())
    `;

    db.query(
      insertQuery,
      [taskId, user_id, finalStatus, changed_by],
      (err2, results) => {
        if (err2) {
          console.error(" Error adding task history:", err2);
          return res
            .status(500)
            .json({ success: false, message: "Error adding task history" });
        }

        //  Step 4: Update assignee table if needed (mark active)
        const updateAssignee = `
          UPDATE task_assignees 
          SET assigned_at = NOW() 
          WHERE task_id = ? AND user_id = ?
        `;

        db.query(updateAssignee, [taskId, user_id], (err3) => {
          if (err3)
            console.warn(" Warning updating assignee timestamp:", err3);
        });

        res.json({
          success: true,
          message: ` Task history added successfully${
            finalStatus === "Reactivated" ? " (User reactivated)" : ""
          }`,
          insertId: results.insertId,
        });
      }
    );
  });
};

// Delete task
const deleteTask = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;
  const userRoleId = req.user.role_id;
  const displayName = req.user.name // Who have deleted the task

  const truncate = (str, n = 40) => {
    if (!str) return "";
    return str.length > n ? str.substring(0, n) + "..." : str;
  };

  if (!id) 
    return res.status(400).json({ success: false, message: "Missing task ID" });

  const adminRoles = [1, 2, 3];

  const getTaskQuery = `
    SELECT t.id, t.created_by, t.description, u.email AS creator_email
    FROM task_reminders t
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id = ?;
  `;

  db.query(getTaskQuery, [id], (err, taskResult) => {
    if (err) {
      console.error("DB Query Error (getTaskQuery):", err);
      return res.status(500).json({ success: false, message: err.message });
    }

    if (taskResult.length === 0) 
      return res.status(404).json({ success: false, message: "Task not found" });
    
    const task = taskResult[0];
    const isCreator = task.created_by === userId;
    const isSuperAdmin = adminRoles.includes(userRoleId);

    if (!isCreator && !isSuperAdmin) {
      return res.status(403).json({
        success: false,
        message: "Only the creator or admin can delete this task",
      });
    }

    // Fetch assignees before deletion
    const getAssigneesQuery = `
      SELECT u.email
      FROM task_assignees ta
      LEFT JOIN users u ON ta.user_id = u.id
      WHERE ta.task_id = ?;
    `;

    db.query(getAssigneesQuery, [id], (assigneesErr, assignees) => {
      if (assigneesErr) {
        return res.status(500).json({ success: false, message: "Faile to load assignees" });
      }

      const assigneeEmails = assignees.map(a=> a.email).filter(Boolean);

      // Delete history
      db.query(`DELETE FROM task_history WHERE task_id = ?`, [id], (hErr) => {
        if (hErr)
          return res.status(500).json({ success: false, message: "Failed to delete history" });

        // Delete assignees
        db.query(`DELETE FROM task_assignees WHERE task_id = ?`, [id], (aErr) => {
          if (aErr) 
            return res.status(500).json({ success: false, message: "Failed to delete assignees" });


          // Delete the task
          db.query(`DELETE FROM task_reminders WHERE id = ?`, [id], async (tErr, result) => {
            if (tErr)
              return res.status(500).json({ success: false, message: "Failed to delete task" });

            if (result.affectedRows === 0) 
              return res.status(404).json({ success: false, message: "Task not found" });

            // Send Email Notification
            try {
              const subject = "Task Deleted";

              const htmlContent = getEmailTemplate(
                "#dc2626",
                "Task Deleted",
                "A task asigned to you has been deleted.",
                displayName,
                truncate(task.description, 40),
                process.env.FRONTEND_URL
              );

              const recipients = [
                task.creator_email,
                ...assigneeEmails
              ].filter(Boolean);

              for (let email of recipients) {
                await transporter.sendMail({
                  from: "Reminder App <developer@euroteckindia.com>" ,
                  // from: process.env.EMAIL_USER,
                  to: email,
                  subject,
                  html: htmlContent,
                });
              }
            } catch (mailErr) {
              console.error("Email sending error:", mailErr);
            }

            return res.json({ success: true, message: "Task deleted & notifcation sent" });
          });
        });
      });
    });
  });
};

module.exports = { sendReminder, getAllTasks, updateTaskStatus, 
  getTaskById, deleteTask, getTaskHistory, addTaskHistory };
