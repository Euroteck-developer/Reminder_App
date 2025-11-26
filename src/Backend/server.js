const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const { Server } = require("socket.io");
const setupSocket = require("./socket");

dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const allowedOrigin =
    process.env.CORS_ORIGIN || process.env.FRONTEND_URL;

app.use(
  cors({
    origin: allowedOrigin,
    credentials: true,
  })
);

app.use(bodyParser.json());

// Static Files
app.use(
  "/uploads/profile_pics",
  express.static(path.join(__dirname, "uploads/profile_pics"))
);

// Import Routes
const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/userRoutes");
const passwordRoutes = require("./routes/password");
const userProfile = require("./routes/userProfile");
const remindersRoutes = require("./routes/reminder");
const meetingsRoutes = require("./routes/meetings");
const notificationsRoutes = require("./routes/notification");
const statisticsRoutes = require("./routes/statistics");
const taskSelfReminderRoutes = require("./routes/taskSelfReminder");

// Automatic mail sender node-cron
require("./controllers/taskReminderCron");

// API Routes
app.use("/api/auth", authRoutes);

app.use("/api/users", authRoutes);

app.use("/api/users", userProfile);

app.use("/api/password", passwordRoutes);

app.use("/api/reminders", remindersRoutes);

app.use("/api/meetings", meetingsRoutes);

app.use("/api", userRoutes);

app.use("/api/notifications", notificationsRoutes);

app.use("/api/stats", statisticsRoutes);

app.use("/api/self-reminder", taskSelfReminderRoutes);


// Root route test
app.get("/", (req, res) => res.send(" Notification App Backend Running"));

//  Socket.io Setup
const io = new Server(server, {
  cors: {
    origin:  process.env.CORS_ORIGIN || process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

setupSocket(io);

// Store active user sockets
const onlineUsers = new Map();
app.set("onlineUsers", onlineUsers);

// Make io accessible to routes
app.set("io", io);
app.set("onlineUsers", onlineUsers);

// Start Server
const PORT = process.env.PORT;
server.listen(PORT, () => {
console.log(" Running in:", PORT);
});

// Export (for controllers)
module.exports = { io, onlineUsers };
