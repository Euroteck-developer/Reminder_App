// // db.js
// const mysql = require("mysql2");
// const dotenv = require("dotenv");
// dotenv.config();

// const dbConfig = {
//   host: process.env.DB_HOST,
//   port: process.env.DB_PORT,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   ssl: { rejectUnauthorized: false } // required for Railway
// };

// const db = mysql.createConnection(dbConfig);

// // Retry connection if it fails
// function connectWithRetry() {
//   db.connect(err => {
//     if (err) {
//       console.error("❌ DB connection failed:", err.code, "-", err.sqlMessage || err.message);
//       console.log("⏳ Retrying in 5 seconds...");
//       setTimeout(connectWithRetry, 5000);
//       return;
//     }
//     console.log("✅ Connected to MySQL (Railway)");
//   });
// }

// connectWithRetry();

// module.exports = db;

// const mysql = require("mysql2");
// const dotenv = require("dotenv");
// dotenv.config();

// const dbConfig = {
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT,
//   ssl: { rejectUnauthorized: false }
// };

// function getConnection() {
//   const conn = mysql.createConnection(dbConfig);

//   conn.on("error", err => {
//     console.log("MYSQL ERROR:", err.code);
//   });

//   return conn;
// }

// module.exports = getConnection;

const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false },
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

db.on("error", (err) => {
  console.log("MYSQL ERROR:", err.code);
});

module.exports = db;


// const mysql = require("mysql2");
// const dotenv = require("dotenv");
// dotenv.config();

// const db = mysql.createConnection({
//   host: process.env.DB_HOST,
//   user: process.env.DB_USER,
//   password: process.env.DB_PASSWORD,
//   database: process.env.DB_NAME,
//   port: process.env.DB_PORT,
//   ssl: { rejectUnauthorized: false }
// });

// db.connect(err => {
//   if (err) {
//     console.error("DB connection failed:", err);
//     process.exit(1);
//   }
//   console.log(" Connected to MySQL");
// });

// module.exports = db;
