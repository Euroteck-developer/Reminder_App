const fs = require("fs");
const path = require("path");
const db = require("../db");
const bcrypt = require("bcryptjs");
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

// Helper to delete file if exists
const deleteFile = (filePath) => {
  if (fs.existsSync(filePath)) {
    fs.unlink(filePath, (err) => {
      if (err) console.error("Error deleting file:", err);
      else console.log("Deleted file:", filePath);
    });
  }
};

// GET user profile (DOB as-is from DB)
const getUserProfile = (req, res) => {
  const sql = `
    SELECT u.*, d.name AS department, r.name AS role 
    FROM users u 
    LEFT JOIN departments d ON u.dept_id = d.id 
    LEFT JOIN roles r ON u.role_id = r.id 
    WHERE u.id = ?`;

  db.query(sql, [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (!rows.length) return res.status(404).json({ message: "User not found" });

    res.json(rows[0]);
  });
};

// PUT update profile
const updateUserProfile = (req, res) => {
  const userId = req.user.id;
  const {
    name,
    email,
    mobile,
    gender,
    dob,
    country,
    state,
    place,
    dept_id,
    role_id,
    remove_profile_pic
  } = req.body;

  // Get existing profile image
  db.query(
    "SELECT profile_pic FROM users WHERE id = ?",
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ message: "Server error" });

      const user = rows[0];
      let profilePicPath = user.profile_pic;

      // Handle profile image removal
      if (remove_profile_pic === "true" && profilePicPath) {
        deleteFile(path.join(__dirname, "../", profilePicPath));
        profilePicPath = null;
      }

      // Handle new profile image upload
      if (req.file) {
        if (profilePicPath)
          deleteFile(path.join(__dirname, "../", profilePicPath));

        profilePicPath = "/uploads/profile_pics/" + req.file.filename;
      }

      // Update query
      const updateSql = `
        UPDATE users SET
          name = ?, email = ?, mobile = ?, gender = ?, dob = ?, 
          country = ?, state = ?, place = ?, dept_id = ?, 
          role_id = ?, profile_pic = ?
        WHERE id = ?
      `;

      db.query(
        updateSql,
        [
          name,
          email,
          mobile,
          gender,
          dob, // sent exactly as received "YYYY-MM-DD"
          country,
          state,
          place,
          dept_id,
          role_id,
          profilePicPath,
          userId
        ],
        (updateErr) => {
          if (updateErr)
            return res.status(500).json({ message: "Server error" });

          // Fetch UPDATED user, return DOB as string (prevents timezone shifting)
          const selectSql = `
            SELECT 
              u.id,
              u.name,
              u.email,
              u.mobile,
              u.gender,
              DATE_FORMAT(u.dob, '%Y-%m-%d') AS dob,
              u.country,
              u.state,
              u.place,
              u.dept_id,
              u.role_id,
              u.profile_pic,
              u.level,
              d.name AS department,
              r.name AS role
            FROM users u
            LEFT JOIN departments d ON u.dept_id = d.id
            LEFT JOIN roles r ON u.role_id = r.id
            WHERE u.id = ?
          `;

          db.query(selectSql, [userId], (selectErr, updatedRows) => {
            if (selectErr)
              return res.status(500).json({ message: "Server error" });

            res.json(updatedRows[0]);
          });
        }
      );
    }
  );
};


// Delete profile image separately
const removeProfileImage = (req, res) => {
  const userId = req.user.id;

  db.query("SELECT profile_pic FROM users WHERE id = ?", [userId], (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });

    const user = rows[0];
    if (!user || !user.profile_pic) 
      return res.status(400).json({ message: "No profile image to remove" });

    const filePath = path.join(__dirname, "../", user.profile_pic);

    // Delete file safely
    fs.unlink(filePath, (err) => {
      if (err) {
        console.error("Error deleting profile image:", err.message);
        // Still update DB even if file is missing
      }

      // Update DB
      db.query("UPDATE users SET profile_pic = NULL WHERE id = ?", [userId], (updateErr) => {
        if (updateErr) return res.status(500).json({ message: "Server error" });
        res.json({ message: "Profile image removed successfully" });
      });
    });
  });
};

// GET departments
const getDepartments = (req, res) => {
  db.query("SELECT * FROM departments", (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(rows);
  });
};

// GET roles
const getRoles = (req, res) => {
  db.query("SELECT * FROM roles", (err, rows) => {
    if (err) return res.status(500).json({ message: "Server error" });
    res.json(rows);
  });
};

// creating new users
const createUser = async (req, res) => {
  const {
    name,
    email,
    mobile,
    dob,
    gender,
    dept_id,
    role_id,
    reports_to,
    country,
    state,
    place,
    password,
    level,
  } = req.body;

  const profilePicPath = req.files?.avatar
    ? `/uploads/profile_pics/${req.files.avatar[0].filename}`
    : null;

  try {
    // Determine if user is MD or Director
    const isTopRole = ["2", "3"].includes(String(role_id)); // 2 = Director, 3 = MD
    const isManager = Number(level) > 0; // Only managers get level 1-5

    const finalDeptID = isTopRole ? null : dept_id;
    const finalReportsTo = isTopRole ? null : reports_to;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const sql = `
      INSERT INTO users
      (name, email, mobile, dob, gender, dept_id, role_id, reports_to, country, state, place, level, password, profile_pic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.query(
      sql,
      [
        name,
        email,
        mobile,
        dob,
        gender,
        finalDeptID,
        role_id,
        finalReportsTo,
        country,
        state,
        place,
        isManager ? level : 0,
        hashedPassword,
        profilePicPath,
      ],
      async (err, result) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res
              .status(400)
              .json({ success: false, message: "Email already exists" });
          }
          console.error("Error inserting user:", err);
          return res
            .status(500)
            .json({ success: false, message: "Database error" });
        }

        // Send Welcome mail
        const mailOptions = {
          from: `"Reminder App" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: "Welcome to Reminder App - Your Login Details",
          html: `
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb; padding:20px;">
            <tr>
              <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color:#ffffff; border-collapse:collapse;">
                  <tr>
                    <td align="center" bgcolor="#007bff" style="padding:20px 30px; color:#ffffff; font-family:Arial,sans-serif;">
                      <h2 style="margin:0; font-size:22px; font-weight:600;">Welcome to Reminder App 🎉</h2>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:30px; font-family:Arial,sans-serif; color:#333333; line-height:1.6;">
                      <p>Dear <strong>${name}</strong>,</p>
                      <p>Your account has been successfully created for the <strong>Reminder App</strong>.</p>
                      
                      <p><strong>Here are your login details:</strong></p>

                      <table width="100%" cellpadding="8" cellspacing="0" border="0" style="background-color:#f0f4ff; border-radius:4px;">
                        <tr>
                          <td><strong>Email:</strong> ${email}</td>
                        </tr>
                        <tr>
                          <td><strong>Password:</strong> ${password}</td>
                        </tr>
                      </table>

                      <p style="margin-top:20px;">You can now log in and start managing your tasks and reminders efficiently.</p>
                      <p>Please change your password after your first login.</p>

                      <table align="center" style="margin:25px auto;">
                        <tr>
                          <td align="center" bgcolor="#007bff" style="border-radius:4px;">
                            <a href="${process.env.FRONTEND_URL}" 
                              style="font-size:16px; font-weight:bold; text-decoration:none; color:#ffffff; padding:12px 25px; display:inline-block;">
                              Login Now
                            </a>
                          </td>
                        </tr>
                      </table>

                      <p style="font-size:14px; color:#666666;">If you have any questions, feel free to contact support.</p>
                      <p>Warm regards,<br><strong>Euroteck Team</strong></p>
                    </td>
                  </tr>

                  <tr>
                    <td align="center" bgcolor="#f1f1f1" style="padding:10px; font-size:12px; color:#777;">
                      &copy; ${new Date().getFullYear()} Reminder App. All rights reserved.
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>`
        };

        try {
          await transporter.sendMail(mailOptions);
          console.log(`Welcome email sent to ${email}`);
        } catch (emailErr) {
          console.error("Error sending email:", emailErr);
        }

        return res.json({
          success: true,
          message: "User created successfully & welcome email sent!",
        });
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Get ReportTo list based on role hierarchy
const getReportToList = (req, res) => {
  const { role_id, level } = req.query;

  if (!role_id) {
    return res.status(400).json({ message: "role_id is required" });
  }

  const rId = parseInt(role_id);
  const lvl = level ? parseInt(level) : null;

  let rolesToFetch = [];
  let levelToFetch = null;

  switch (rId) {
    case 5: // User
      rolesToFetch = [4];
      break;

    case 4: // Manager
      if (!lvl || isNaN(lvl)) {
        // Level not selected yet  avoid NaN error
        return res.json([]);
      }

      if (lvl === 1) {
        rolesToFetch = [2, 3]; // L1 → Director + MD
      } else {
        rolesToFetch = [4];
        levelToFetch = lvl - 1;
      }
      break;

    case 2:
    case 3:
    case 1:
      rolesToFetch = [2, 3, 4];
      break;

    default:
      rolesToFetch = [];
  }

  if (!rolesToFetch.length) return res.json([]);

  let sql = `
    SELECT u.id, u.name
    FROM users u
    WHERE u.role_id IN (?)
  `;

  const params = [rolesToFetch];

  if (levelToFetch !== null) {
    sql += ` AND u.level = ?`;
    params.push(levelToFetch);
  }

  db.query(sql, params, (err, rows) => {
    if (err) {
      console.error("Reports To query error:", err);
      return res.status(500).json({ message: "Server error", error: err });
    }
    res.json(rows.map(r => ({ id: r.id, name: r.name })));
  });
};

//Getting all users except (superAdmin, md and director)
const getAllUsers = (req, res) => {
  const viewerRoleId = parseInt(req.user?.role_id || 0); // comes from verified token

  // console.log("Viewer Role ID:", viewerRoleId);

  let roleFilter = "";

  // Only Superadmin (1), Managing Director (2), and Director (3) can see roles 2 & 3
  if (![1, 2, 3].includes(viewerRoleId)) {
    roleFilter = "WHERE u.role_id NOT IN (2, 3)";
  }

  const sql = `
    SELECT 
      u.id,
      u.name,
      u.email,
      u.mobile,
      u.dob,
      u.gender,
      u.role_id,
      u.level,
      d.name AS department,
      r.name AS role,
      u.country,
      u.state,
      u.place,
      u.reports_to AS reports_to_id,
      mgr.name AS reports_to
    FROM users u
    LEFT JOIN departments d ON u.dept_id = d.id
    LEFT JOIN roles r ON u.role_id = r.id
    LEFT JOIN users mgr ON u.reports_to = mgr.id
    ${roleFilter}
  `;

  db.query(sql, (err, rows) => {
    if (err) {
      console.error("Error fetching users:", err);
      return res.status(500).json({ message: "Server error" });
    }

    res.json(rows);
  });
};

// Update user
const updateUser = (req, res) => {
  const { id } = req.params;
  const { name, email, mobile, dob, gender, dept_id, role_id, level, reports_to, country, state, place } = req.body;

  // Check if email exists for a different user
  const checkEmailSql = "SELECT id FROM users WHERE email = ? AND id != ?";
  db.query(checkEmailSql, [email, id], (err, result) => {
    if (err) return res.status(500).json({ success: false, message: "Database error" });
    
    if (result.length > 0) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // If email is unique, update the user
    const updateSql = `
      UPDATE users
      SET name=?, email=?, mobile=?, dob=?, gender=?, dept_id=?, role_id=?, level=?, reports_to=?, country=?, state=?, place=?
      WHERE id=?
    `;
    db.query(
      updateSql,
      [name, email, mobile, dob, gender, dept_id, role_id, level, reports_to || null, country, state, place, id],
      (err2, result2) => {
        if (err2) return res.status(500).json({ success: false, message: "Database error" });
        res.json({ success: true, message: "User updated successfully" });
      }
    );
  });
};

// Delete user
const deleteUser = (req, res) => {
  const { id } = req.params;

  // 1 Check if the user is assigned to any tasks, meetings, or is a manager
  const dependencyCheckQuery = `
    SELECT 
      (SELECT COUNT(*) FROM task_assignees WHERE user_id = ?) AS task_count,
      (SELECT COUNT(*) FROM meeting_assignees WHERE user_id = ?) AS meeting_count,
      (SELECT COUNT(*) FROM users WHERE reports_to = ?) AS report_count
  `;

  db.query(dependencyCheckQuery, [id, id, id], (err, results) => {
    if (err) {
      console.error(" Error checking dependencies:", err);
      return res
        .status(500)
        .json({ success: false, message: "Database error during check" });
    }

    const { task_count, meeting_count, report_count } = results[0];

    if (task_count > 0 || meeting_count > 0 || report_count > 0) {
      console.warn(
        `User ${id} has dependencies: ${task_count} tasks, ${meeting_count} meetings, ${report_count} reports.`
      );

      return res.status(400).json({
        success: false,
        message:
          report_count > 0
            ? "Cannot delete user. Some employees report to this user. Reassign them first."
            : "This user has assigned tasks or meetings. Please reassign before deleting.",
      });
    }

    // 2 If safe, proceed with deletion
    const deleteQuery = "DELETE FROM users WHERE id = ?";
    db.query(deleteQuery, [id], (deleteErr, result) => {
      if (deleteErr) {
        console.error(" Error deleting user:", deleteErr);
        return res
          .status(500)
          .json({ success: false, message: "Error deleting user" });
      }

      if (result.affectedRows === 0) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      console.log(`User ${id} deleted successfully`);
      res.json({ success: true, message: "User deleted successfully" });
    });
  });
};

module.exports = { getUserProfile, updateUserProfile, removeProfileImage,
  getDepartments, getRoles, createUser, getReportToList, getAllUsers,
  updateUser, deleteUser
};

