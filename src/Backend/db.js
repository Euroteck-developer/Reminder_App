const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: { rejectUnauthorized: false }
};

const db = mysql.createConnection(dbConfig);

// Retry connection instead of exiting
function connectWithRetry() {
  db.connect(err => {
    if (err) {
      console.error("❌ DB connection failed:", err.code, "-", err.sqlMessage || err.message);
      console.log("⏳ Retrying in 5 seconds...");
      setTimeout(connectWithRetry, 5000);
      return;
    }
    console.log("✅ Connected to MySQL (Railway)");
  });
}

connectWithRetry();

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
