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
const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST,        // Railway host
  port: process.env.DB_PORT,        // Railway port
  user: process.env.DB_USER,        // Railway user
  password: process.env.DB_PASSWORD,// Railway password
  database: process.env.DB_NAME,    // Railway database
  ssl: { rejectUnauthorized: false } // required for Railway
});

console.log("📌 Environment: Production (Railway)");
console.log("📌 Connecting to:", process.env.DB_HOST + ":" + process.env.DB_PORT);

db.connect(err => {
  if (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL (Railway)");
});

module.exports = db;
