const cron = require("node-cron");
const db = require("../db");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Email transporter setup
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { ciphers: "SSLv3" },
});

// Run daily at 11:30 AM
cron.schedule("30 11 * * *", async () => {
  console.log(" Daily Task Reminder (Round-Robin) started...");

  const query = `
    SELECT 
      tr.id,
      tr.description AS task_name,
      tr.status,
      tr.due_date,
      tr.extended_due_date,
      u1.name AS created_by_name
    FROM task_reminders tr
    JOIN users u1 ON tr.created_by = u1.id
    WHERE tr.status IN ('Pending', 'In Progress');
  `;

  db.query(query, async (err, tasks) => {
    if (err) {
      console.error(" Error fetching tasks:", err);
      return;
    }

    if (!tasks.length) {
      console.log(" No active tasks found.");
      return;
    }

    // Group tasks by assignee
    const grouped = {};

    for (const task of tasks) {
      const getAssignees = `
        SELECT u.id, u.email, u.name 
        FROM task_assignees ta 
        JOIN users u ON ta.user_id = u.id 
        WHERE ta.task_id = ?
      `;

      const [assignees] = await new Promise((resolve) =>
        db.query(getAssignees, [task.id], (err, res) => resolve([res || []]))
      );

      for (const a of assignees) {
        if (!grouped[a.id]) grouped[a.id] = { user: a, tasks: [] };
        grouped[a.id].tasks.push(task);
      }
    }

    const users = Object.values(grouped);
    if (!users.length) {
      console.log("No assignees found for active tasks.");
      return;
    }

    console.log(` ${users.length} users found with active tasks.`);

    // Find max number of tasks among all users
    const maxTasks = Math.max(...users.map((u) => u.tasks.length));
    const delayBetweenRounds = 3 * 60 * 1000; // 3 minutes between rounds

    //  Round-robin sending
    for (let round = 0; round < maxTasks; round++) {
      setTimeout(() => {
        console.log(`\n Sending Round ${round + 1} of Task Emails...\n`);

        users.forEach((u) => {
          const task = u.tasks[round];
          if (task) sendSingleTaskEmail(u.user, task, round + 1);
        });
      }, round * delayBetweenRounds);
    }
  });
});

// Send single task email per user (for that round)
async function sendSingleTaskEmail(user, task, round) {
  const shortTaskName =
    task.task_name.length > 30
      ? task.task_name.substring(0, 30) + "..."
      : task.task_name;

  const dueDate = task.extended_due_date || task.due_date;
  const formattedDueDate = dueDate
    ? new Date(dueDate).toLocaleDateString()
    : "—";

  const subject = "Task Reminder App";

  const html = `
    <div style="max-width:600px;margin:auto;background:#fff;border:1px solid #ddd;
      border-radius:8px;font-family:Arial,sans-serif;box-shadow:0 3px 8px rgba(0,0,0,0.05);">
      <div style="background:#0078D7;color:white;padding:14px;border-top-left-radius:8px;border-top-right-radius:8px;">
        <h3 style="margin:0;">Daily Task Reminder</h3>
      </div>
      <div style="padding:20px;">
        <p>Hello <b>${user.name}</b>,</p>
        <p>Here’s your task for this reminder round:</p>
        <table style="width:100%;border-collapse:collapse;margin-top:10px;">
          <tr><th align="left">Task</th><td>${shortTaskName}</td></tr>
          <tr><th align="left">Created By</th><td>${task.created_by_name}</td></tr>
          <tr><th align="left">Status</th><td>${task.status}</td></tr>
          <tr><th align="left">Due Date</th><td>${formattedDueDate}</td></tr>
        </table>
        <div style="margin-top:20px;text-align:center;">
          <a href="${process.env.FRONTEND_URL}" 
            style="display:inline-block;background:#0078D7;color:white;padding:10px 20px;
            text-decoration:none;border-radius:5px;font-weight:bold;">View Task Dashboard</a>
        </div>
      </div>
      <div style="text-align:center;color:#777;font-size:12px;padding:10px 0;border-top:1px solid #eee;">
        © ${new Date().getFullYear()} Task Reminder System
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"Task Reminder" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject,
      html,
    });

    console.log(
      `Round ${round} → Sent to ${user.email} (${user.name}) | Task: "${shortTaskName}"`
    );
  } catch (err) {
    console.error(
      ` Round ${round} → Failed for ${user.email} (${user.name}):`,
      err.message
    );
  }
}

module.exports = {};
