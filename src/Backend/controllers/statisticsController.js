const db = require("../db");

const getUserPerformanceStats = (req, res) => {
  let userId = req.query.userId;
  const roleId = req.user.role_id;
  const type = req.query.type || "assigned";

  // Convert 'self' to actual user id
  if (userId === "self") {
    userId = req.user.id;
  }

  // Role-based allowed filters
  const roleAccess = {
    1: ["assigned", "personal", "created", "all"],
    2: ["assigned", "personal", "created", "all"],
    3: ["assigned", "personal", "created", "all"],
    4: ["personal", "assigned", "created"],
    5: ["personal", "assigned", "created"],
  };

  const allowedTypes = roleAccess[roleId] || ["assigned"];
  if (!allowedTypes.includes(type)) {
    return res.status(403).json({ success: false, message: "Access denied" });
  }

  // Build condition according to type
  let condition = "";
  // We'll choose queryType: 'perAssignee' vs 'perTask'
  // perAssignee → rows represent task + specific assignee (useful for 'assigned' & 'personal')
  // perTask     → rows represent unique task (useful for 'created' & 'all')
  let querySQL = "";

  if (type === "personal") {
    // personal => task created by user AND assigned to themselves (perAssignee is fine)
    condition = `AND tr.created_by = ${userId} AND th.user_id = ${userId}`;
    // use per-assignee query
    querySQL = `
      SELECT 
        tr.id AS task_id,
        tr.description,
        tr.priority,
        tr.status AS task_status,
        tr.created_by,
        u1.name AS created_by_name,
        th.user_id,
        u2.name AS user_name,
        (
          SELECT th2.status
          FROM task_history th2
          WHERE th2.task_id = tr.id AND th2.user_id = th.user_id
          ORDER BY th2.changed_at DESC
          LIMIT 1
        ) AS latest_history_status,
        MAX(CASE WHEN th.status = 'Lost' THEN th.changed_at END) AS last_lost_date,
        MAX(CASE WHEN th.status = 'Reassigned' THEN th.changed_at END) AS last_reassign_date
      FROM task_reminders tr
      JOIN task_history th ON tr.id = th.task_id
      JOIN users u1 ON tr.created_by = u1.id
      JOIN users u2 ON th.user_id = u2.id
      WHERE 1=1 ${condition}
      GROUP BY tr.id, th.user_id
      ORDER BY tr.id DESC;
    `;
  } else if (type === "assigned") {
    // assigned => tasks assigned to the user (perAssignee)
    condition = `AND th.user_id = ${userId}`;
    querySQL = `
      SELECT 
        tr.id AS task_id,
        tr.description,
        tr.priority,
        tr.status AS task_status,
        tr.created_by,
        u1.name AS created_by_name,
        th.user_id,
        u2.name AS user_name,
        (
          SELECT th2.status
          FROM task_history th2
          WHERE th2.task_id = tr.id AND th2.user_id = th.user_id
          ORDER BY th2.changed_at DESC
          LIMIT 1
        ) AS latest_history_status,
        MAX(CASE WHEN th.status = 'Lost' THEN th.changed_at END) AS last_lost_date,
        MAX(CASE WHEN th.status = 'Reassigned' THEN th.changed_at END) AS last_reassign_date
      FROM task_reminders tr
      JOIN task_history th ON tr.id = th.task_id
      JOIN users u1 ON tr.created_by = u1.id
      JOIN users u2 ON th.user_id = u2.id
      WHERE 1=1 ${condition}
      GROUP BY tr.id, th.user_id
      ORDER BY tr.id DESC;
    `;
  } else if (type === "created") {
    // created => tasks created by the user → return unique tasks (perTask)
    condition = `AND tr.created_by = ${userId}`;
    querySQL = `
      SELECT
        tr.id AS task_id,
        tr.description,
        tr.priority,
        tr.status AS task_status,
        tr.created_by,
        u1.name AS created_by_name,
        -- latest assigned user for the task (if any)
        (
          SELECT u2.name
          FROM task_history th2
          JOIN users u2 ON th2.user_id = u2.id
          WHERE th2.task_id = tr.id
          ORDER BY th2.changed_at DESC
          LIMIT 1
        ) AS last_assigned_to_name,
        -- latest history status for the task (overall)
        (
          SELECT th3.status
          FROM task_history th3
          WHERE th3.task_id = tr.id
          ORDER BY th3.changed_at DESC
          LIMIT 1
        ) AS latest_history_status,
        -- last lost/reassign timestamps (may be null)
        (
          SELECT MAX(CASE WHEN th4.status = 'Lost' THEN th4.changed_at ELSE NULL END)
          FROM task_history th4
          WHERE th4.task_id = tr.id
        ) AS last_lost_date,
        (
          SELECT MAX(CASE WHEN th5.status = 'Reassigned' THEN th5.changed_at ELSE NULL END)
          FROM task_history th5
          WHERE th5.task_id = tr.id
        ) AS last_reassign_date
      FROM task_reminders tr
      LEFT JOIN users u1 ON tr.created_by = u1.id
      WHERE 1=1 ${condition}
      ORDER BY tr.id DESC;
    `;
  } else if (type === "all") {
    // all => admin only; return unique tasks (perTask)
    if (![1, 2, 3].includes(roleId)) {
      return res.status(403).json({ success: false, message: "Access denied for all view" });
    }

    if (userId) {
      // show tasks either created by or assigned to the provided userId, but still unique tasks
      condition = `
        AND (
          tr.created_by = ${userId}
          OR EXISTS (
            SELECT 1 FROM task_history thx WHERE thx.task_id = tr.id AND thx.user_id = ${userId}
          )
        )
      `;
    } else {
      condition = ""; // no filter => all tasks
    }

    querySQL = `
      SELECT
        tr.id AS task_id,
        tr.description,
        tr.priority,
        tr.status AS task_status,
        tr.created_by,
        u1.name AS created_by_name,
        (
          SELECT u2.name
          FROM task_history th2
          JOIN users u2 ON th2.user_id = u2.id
          WHERE th2.task_id = tr.id
          ORDER BY th2.changed_at DESC
          LIMIT 1
        ) AS last_assigned_to_name,
        (
          SELECT th3.status
          FROM task_history th3
          WHERE th3.task_id = tr.id
          ORDER BY th3.changed_at DESC
          LIMIT 1
        ) AS latest_history_status,
        (
          SELECT MAX(CASE WHEN th4.status = 'Lost' THEN th4.changed_at ELSE NULL END)
          FROM task_history th4
          WHERE th4.task_id = tr.id
        ) AS last_lost_date,
        (
          SELECT MAX(CASE WHEN th5.status = 'Reassigned' THEN th5.changed_at ELSE NULL END)
          FROM task_history th5
          WHERE th5.task_id = tr.id
        ) AS last_reassign_date
      FROM task_reminders tr
      LEFT JOIN users u1 ON tr.created_by = u1.id
      WHERE 1=1 ${condition}
      ORDER BY tr.id DESC;
    `;
  } else {
    // fallback safety
    return res.status(400).json({ success: false, message: "Invalid type" });
  }

  // Execute the chosen query
  db.query(querySQL, (err, results) => {
    if (err) {
      console.error("DB Error:", err);
      return res.status(500).json({ success: false, message: "Database error" });
    }

    // Ensure results is an array
    results = results || [];

    // Assign performance_status for each row, then count
    results.forEach((r) => {
      // Normalize fields that may differ between perAssignee/perTask queries:
      // - some queries returned user_name (perAssignee) or last_assigned_to_name (perTask)
      r.user_name = r.user_name || r.last_assigned_to_name || null;

      let perf = "Pending";

      const isLost =
        r.latest_history_status === "Lost" ||
        (r.last_lost_date &&
          (!r.last_reassign_date ||
            new Date(r.last_lost_date) > new Date(r.last_reassign_date)));

      if (isLost) {
        perf = "Lost";
      } else if (r.task_status === "Completed") {
        perf = "Completed";
      } else {
        perf = "Pending";
      }

      r.performance_status = perf;
      r.assigned_to_name = r.user_name || null;
    });

    // Count after assigning performance_status — guarantees sum == results.length
    let completed = 0;
    let lost = 0;
    let pending = 0;

    results.forEach((r) => {
      if (r.performance_status === "Completed") completed++;
      else if (r.performance_status === "Lost") lost++;
      else pending++;
    });

    const totalTasks = results.length;
    const performancePercentage =
      totalTasks > 0 ? ((completed / totalTasks) * 100).toFixed(2) : 0;

    res.json({
      success: true,
      completed,
      lost,
      pending,
      totalTasks,
      performancePercentage,
      data: results,
    });
  });
};

module.exports = { getUserPerformanceStats };
