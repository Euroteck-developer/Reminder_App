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

// Detect environment: local vs Railway
const isProduction = process.env.DB_HOST && process.env.DB_HOST !== "localhost";

const dbConfig = isProduction
  ? {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: { rejectUnauthorized: false } // required for Railway
    }
  : {
      host: process.env.LOCAL_DB_HOST,
      port: process.env.LOCAL_DB_PORT,
      user: process.env.LOCAL_DB_USER,
      password: process.env.LOCAL_DB_PASSWORD,
      database: process.env.LOCAL_DB_NAME
    };

console.log("📌 Environment:", isProduction ? "Production (Railway)" : "Local");
console.log("📌 Connecting to:", dbConfig.host + ":" + dbConfig.port);

const db = mysql.createConnection(dbConfig);

db.connect(err => {
  if (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }
  console.log("✅ Connected to MySQL (" + (isProduction ? "Railway" : "Local") + ")");
});

module.exports = db;
