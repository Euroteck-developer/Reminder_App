const express = require("express");
const router = express.Router();
const {
  scheduleMeeting,
  getAllMeetings,
  updateMeetingStatus,
  deleteMeeting, 
} = require("../controllers/meetingController");
const { verifyToken } = require("../middleware/authMiddleware");

// Schedule a new meeting
router.post("/", verifyToken, scheduleMeeting);

//  Get all meetings
router.get("/", verifyToken, getAllMeetings);

//  Update meeting status (Pending / Completed / Cancelled)
router.put("/status", verifyToken, updateMeetingStatus);

//  Delete a meeting (only the creator can delete)
router.delete("/:meetingId", verifyToken, deleteMeeting);

module.exports = router;
