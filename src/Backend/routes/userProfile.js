const express = require("express");
const { getUserProfile, getDepartments, getRoles, updateUserProfile, removeProfileImage, createUser, getReportToList,
   getAllUsers, updateUser, deleteUser } = require("../controllers/userProfileController");
const { verifyToken } = require("../middleware/authMiddleware");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const router = express.Router();

// Ensure uploads/profile_pics folder exists
const uploadDir = path.join(__dirname, "../uploads/profile_pics");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer config for profile image upload
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadDir);
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" + path.extname(file.originalname));
//   }
// });

// const upload = multer({ storage });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 // 100 KB
  },
  fileFilter: (req, file, cb) => {
    // OPTIONAL: allow only images
    const allowed = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG/PNG images allowed'));
    }
    cb(null, true);
  }
});

// Multer file size error handling
// router.use((err, req, res, next) => {
//   if (err instanceof multer.MulterError) {
//     if (err.code === "LIMIT_FILE_SIZE") {
//       return res
//         .status(400)
//         .json({ success: false, message: "File Size should be less than or equal to 100kb"});
//     }
//   }
//   if (err) {
//     return res.status(400).json({ success: false, message: err.message });
//   }
//   next();
// });

//Profile route (Requires JWT)
router.get("/profile", verifyToken, getUserProfile);

//Departments list 
router.get("/departments", getDepartments);

//Roles list
router.get("/roles", getRoles);

//Update profile
router.put("/profile", verifyToken, upload.single("profile_file"), updateUserProfile);

//Delete Profile Picture
router.delete("/profile/image", verifyToken, removeProfileImage);

//creating new user
router.post("/create", upload.single("avatar"), createUser);

//To get list of reporting managers and higher level
router.get("/reports-to", getReportToList);

//To get users except (superAdmin, md and director)
router.get("/all-users", verifyToken, getAllUsers);

//Update users
router.put("/update/:id", updateUser);

//Delete users
router.delete("/delete/:id", deleteUser);

// ✅ MULTER ERROR HANDLER (must be at bottom)
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size should be less than or equal to 100KB"
      });
    }
  }

  if (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "File upload error"
    });
  }

  next();
});

module.exports = router;
