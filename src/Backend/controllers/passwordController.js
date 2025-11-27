// const db = require("../db");
// const bcrypt = require("bcryptjs");
// const { addSeconds } = require("date-fns"); 
// const nodemailer = require("nodemailer");
// require("dotenv").config();

// // Outlook transporter setup
// // const transporter = nodemailer.createTransport({
// //   host: process.env.EMAIL_HOST,
// //   port: process.env.EMAIL_PORT,
// //   secure: false,
// //   auth: {
// //     user: process.env.EMAIL_USER,
// //     pass: process.env.EMAIL_PASS,
// //   },
// // });

// const transporter = nodemailer.createTransport({
//   host: "smtp.sendgrid.net",
//   port: 587,
//   secure: false,
//   auth: {
//     user: "apikey",  // literally the word "apikey"
//     pass: process.env.SENDGRID_API_KEY, // your actual API key
//   },
// });


// // Step 1: Send OTP
// const sendOtp = (req, res) => {
//   const { email } = req.body;
//   if (!email) return res.status(400).json({ message: "Email required" });

//   const checkQuery = "SELECT * FROM users WHERE email=?";
//   db.query(checkQuery, [email], (err, results) => {
//     if (err) return res.status(500).json({ message: "Database error" });
//     if (results.length === 0) return res.status(404).json({ message: "Email not found" });

//     const username = results[0].name || results[0].username || "User";
//     const otp = Math.floor(100000 + Math.random() * 900000).toString();
//     const expires = addSeconds(new Date(), 150); // 2:30 min

//     const updateQuery = "UPDATE users SET otp=?, otp_expires=? WHERE email=?";
//     db.query(updateQuery, [otp, expires, email], (err2) => {
//       if (err2) return res.status(500).json({ message: "Database error" });
//       const mailOptions = {
//         // from: `"Reminder App" <${process.env.EMAIL_USER}>`,
//         from: "Reminder App <developer@euroteckindia.com>",
//         to: email,
//         subject: "Secure OTP for Password Reset",
//         text: `Dear ${username}, your OTP is ${otp}. It will expire in 2 minutes 30 seconds.`,
//         html: `
//         <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f2f4f8; padding: 40px 0;">
//           <div style="max-width: 520px; margin: auto; background: #ffffff; border-radius: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.08); overflow: hidden;">
      
//             <!-- Header -->
//             <div style="background: linear-gradient(135deg, #0052cc, #007bff); padding: 22px; text-align: center;">
//               <h1 style="color: #ffffff; font-size: 22px; margin: 0;">Reminder App</h1>
//             </div>
      
//             <!-- Body -->
//             <div style="padding: 32px; color: #333; text-align: left;">
//               <p style="font-size: 16px; margin-bottom: 18px;">Dear <strong>${username}</strong>,</p>

//               <p style="font-size: 15px; line-height: 1.6; color: #444;">
//                 We received a request to reset your account password. Please use the One-Time Password (OTP) below to proceed securely.
//               </p>

//               <div style="text-align: center; margin: 28px 0;">
//                 <div style="
//                   display: inline-block;
//                   background: #007bff;
//                   color: #ffffff;
//                   font-size: 28px;
//                   letter-spacing: 6px;
//                   padding: 14px 28px;
//                   border-radius: 10px;
//                   font-weight: bold;
//                 ">
//                   ${otp}
//                 </div>
//               </div>

//               <p style="font-size: 14px; color: #666;">
//                 This OTP will expire in <strong>2 minutes 30 seconds</strong> for security reasons.
//               </p>

//               <p style="font-size: 14px; color: #666; margin-top: 18px;">
//                 If you did not request a password reset, please disregard this email. Your account remains secure.
//               </p>

//               <p style="font-size: 15px; margin-top: 32px; color: #333;">
//                 Best regards,<br/>
//                 <strong>Reminder App Team</strong>
//               </p>
//             </div>

//             <!-- Footer -->
//             <div style="background: #f7f9fc; padding: 16px; text-align: center; font-size: 12px; color: #888;">
//               &copy; ${new Date().getFullYear()} Notification App. All rights reserved.<br/>
//               This is an automated message, please do not reply.
//             </div>
//           </div>
//         </div>
//         `,
//       };

//       transporter.sendMail(mailOptions, (error, info) => {
//         if (error) {
//           console.error(error);
//           return res.status(500).json({ message: "Failed to send email" });
//         }
//         res.json({ message: "OTP sent to your email" });
//       });
//     });
//   });
// };

// // Step 2: Verify OTP
// const verifyOtp = (req, res) => {
//   const { email, otp } = req.body;
//   if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

//   const query = "SELECT otp, otp_expires FROM users WHERE email=?";
//   db.query(query, [email], (err, results) => {
//     if (err) return res.status(500).json({ message: "Database error" });
//     if (results.length === 0) return res.status(404).json({ message: "Email not found" });

//     const user = results[0];
//     const now = new Date();
//     if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
//     if (new Date(user.otp_expires) < now) return res.status(400).json({ message: "OTP expired" });

//     res.json({ message: "OTP verified" });
//   });
// };

// // Step 3: Reset Password
// const resetPassword = async (req, res) => {
//   const { email, otp, newPassword } = req.body;
//   if (!email || !otp || !newPassword)
//     return res.status(400).json({ message: "All fields required" });

//   const query = "SELECT otp, otp_expires FROM users WHERE email=?";
//   db.query(query, [email], async (err, results) => {
//     if (err) return res.status(500).json({ message: "Database error" });
//     if (results.length === 0) return res.status(404).json({ message: "Email not found" });

//     const user = results[0];
//     const now = new Date();
//     if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
//     if (new Date(user.otp_expires) < now) return res.status(400).json({ message: "OTP expired" });

//     const hashedPassword = await bcrypt.hash(newPassword, 10);
//     const updateQuery = "UPDATE users SET password=?, otp=NULL, otp_expires=NULL WHERE email=?";
//     db.query(updateQuery, [hashedPassword, email], (err2) => {
//       if (err2) return res.status(500).json({ message: "Database error" });
//       res.json({ message: "Password reset successfully" });
//     });
//   });
// };

// module.exports = { sendOtp, verifyOtp, resetPassword };


const db = require("../db");
const bcrypt = require("bcryptjs");
const { addSeconds } = require("date-fns");
const nodemailer = require("nodemailer");
require("dotenv").config();

// Nodemailer with SendGrid
const transporter = nodemailer.createTransport({
  host: "smtp.sendgrid.net",
  port: 587,
  secure: false,
  auth: {
    user: "apikey", // literally "apikey"
    pass: process.env.SENDGRID_API_KEY,
  },
});

// Step 1: Send OTP
const sendOtp = (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const checkQuery = "SELECT * FROM users WHERE email=?";
  db.query(checkQuery, [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "Email not found" });

    const username = results[0].name || results[0].username || "User";
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = addSeconds(new Date(), 150);

    const updateQuery = "UPDATE users SET otp=?, otp_expires=? WHERE email=?";
    db.query(updateQuery, [otp, expires, email], (err2) => {
      if (err2) return res.status(500).json({ message: "Database error" });

      const mailOptions = {
        from: "Reminder App <developer@euroteckindia.com>",
        to: email,
        subject: "Secure OTP for Password Reset",
        text: `Dear ${username}, your OTP is ${otp}. It will expire in 2 minutes 30 seconds.`,
        html: `<h3>Dear ${username},</h3><p>Your OTP is: <b>${otp}</b></p><p>Expires in 2 minutes 30 seconds.</p>`,
      };

      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ message: "Failed to send email" });
        }
        res.json({ message: "OTP sent to your email" });
      });
    });
  });
};

// Step 2: Verify OTP
const verifyOtp = (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

  const query = "SELECT otp, otp_expires FROM users WHERE email=?";
  db.query(query, [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "Email not found" });

    const user = results[0];
    const now = new Date();
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    if (new Date(user.otp_expires) < now) return res.status(400).json({ message: "OTP expired" });

    res.json({ message: "OTP verified" });
  });
};

// Step 3: Reset Password
const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword)
    return res.status(400).json({ message: "All fields required" });

  const query = "SELECT otp, otp_expires FROM users WHERE email=?";
  db.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0) return res.status(404).json({ message: "Email not found" });

    const user = results[0];
    const now = new Date();
    if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
    if (new Date(user.otp_expires) < now) return res.status(400).json({ message: "OTP expired" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateQuery = "UPDATE users SET password=?, otp=NULL, otp_expires=NULL WHERE email=?";
    db.query(updateQuery, [hashedPassword, email], (err2) => {
      if (err2) return res.status(500).json({ message: "Database error" });
      res.json({ message: "Password reset successfully" });
    });
  });
};

module.exports = { sendOtp, verifyOtp, resetPassword };
