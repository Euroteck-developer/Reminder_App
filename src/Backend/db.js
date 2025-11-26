const mysql = require("mysql2");
const dotenv = require("dotenv");
dotenv.config();

const db = mysql.createConnection({
  host: process.env.DB_HOST || process.env.DB_HOST1,
  user: process.env.DB_USER  || process.env.DB_USER1,
  password: process.env.DB_PASSWORD || process.env.DB_PASSWORD1,
  database: process.env.DB_NAME ||  process.env.DB_NAME1,
  port: process.env.DB_PORT
});

db.connect(err => {
  if (err) {
    console.error("DB connection failed:", err);
    process.exit(1);
  }
  console.log(" Connected to MySQL");
});

module.exports = db;
