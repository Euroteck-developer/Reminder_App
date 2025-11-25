const express = require("express");
const router = express.Router();
const { getUserPerformanceStats} = require("../controllers/statisticsController");
const { verifyToken } = require("../middleware/authMiddleware");

//To get statistics (graphs) of the users created
router.get("/user-performance", verifyToken, getUserPerformanceStats);

module.exports = router;