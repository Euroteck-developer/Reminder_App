const express = require("express");
const router = express.Router();
const { sendReminder, getAllTasks, updateTaskStatus, getTaskById, deleteTask, getTaskHistory, addTaskHistory } = require("../controllers/remindersController");
const {verifyToken} = require("../middleware/authMiddleware");

//create a new task remainder
router.post("/", verifyToken, sendReminder);

//Get all tasks
router.get("/", verifyToken,  getAllTasks);

// Update task status & description (assigned user only)
router.put("/update-task-status", verifyToken, updateTaskStatus);

//Get Task by ID 
router.get("/:id", verifyToken, getTaskById);

//Delete Task
router.delete("/:id", verifyToken, deleteTask);

//Adding task to history
router.post("/:taskId/history", verifyToken, addTaskHistory);

//Fetch task history (New, Old, Lost)
router.get("/history/user", verifyToken, getTaskHistory);

module.exports = router;
