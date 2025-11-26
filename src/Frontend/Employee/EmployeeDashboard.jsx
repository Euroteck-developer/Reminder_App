import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, Link } from "react-router-dom";
import {
  FaUserCircle,
  FaTasks,
  FaHistory,
  FaBell,
  FaChartBar,
  FaBars,
  FaTimes,
} from "react-icons/fa";
import { BiSolidDashboard } from "react-icons/bi";
import NavLogo from "../Assets/EUROTECK LOGO.webp";
import ResNavIcon from "../Assets/EUROTECK ICON.webp";
import Profile from "../Pages/Profile";
import ChangePassword from "../Pages/ChangePassword";
import axios from "axios";
import API_URL from "../../Api/Config";
import "../Styles/Dashboard.css";
import Dashboard from "../Pages/Dashboard";
import TaskEdit from "../Pages/TaskEdit";
import Notifications from "../Pages/Notifications";
import NotificationListener from "../Pages/NotificationListener";
import Remainders from "../Pages/Remainders";
import TaskHistory from "../Pages/TaskHistory";
import Statistics from "../Pages/Statistics";

const EmployeeDashboard = () => {
  const [user, setUser] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const toggleProfile = () => setIsProfileOpen(!isProfileOpen);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  // Fetch user profile
  useEffect(() => {
    if (!token) return;
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setUser(res.data))
      .catch((err) => console.error("Error fetching user:", err));
  }, [token]);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const sidebarLinks = [
    { icon: <BiSolidDashboard />, text: "Dashboard", path: "dashboard" },
    { icon: <FaTasks />, text: "Reminders", path: "reminders" },
    { icon: <FaHistory />, text: "Task History", path: "task-history/my-task-history"},
    { icon: <FaChartBar />, text: "Statistics", path: "statistics" },
  ];

  return (
    <div className="dashboard-container">
      {/* Navbar */}
      <header className="dashboard-navbar">
        <div className="navbar-left">
          {isMobile && (
            <button className="mobile-toggle" onClick={toggleSidebar}>
              {isSidebarOpen ? <FaTimes /> : <FaBars />}
            </button>
          )}
          <img
            src={isMobile ? ResNavIcon : NavLogo}
            alt="Logo"
            className={isMobile ? "navbar-icon" : "navbar-logo"}
            style={isMobile ? { height: "26px", width: "26px" } : {}}
          />
        </div>
        <div className="navbar-right">
          <Link to="/user-dashboard/notifications">
            <FaBell size={22} className="icon-btn" />
          </Link>
          <div className="profile-wrapper" onClick={toggleProfile}>
            <FaUserCircle size={28} className="icon-btn" />
            {isProfileOpen && (
              <div className="profile-dropdown">
                <Link to="/user-dashboard/profile">Profile</Link>
                <Link to="/user-dashboard/change-password">Change Password</Link>
                <Link to="/">Logout</Link>
              </div>
            )}
          </div>
          <span className="user-name">{user ? user.name : "Loading..."}</span>
        </div>
      </header>

      {/* Mobile overlay */}
      {isMobile && isSidebarOpen && (
        <div className="mobile-overlay" onClick={toggleSidebar}></div>
      )}

      {/* Body Layout */}
      <div className="dashboard-body">
        {/* Sidebar */}
        {(isSidebarOpen || !isMobile) && (
          <aside className="dashboard-sidebar">
            {sidebarLinks.map((link) => (
              <div
                key={link.text}
                className={`sidebar-link ${
                  activePage === link.text ? "active" : ""
                }`}
                onClick={() => {
                  setActivePage(link.text);
                  navigate(`/user-dashboard/${link.path}`);
                  if (isMobile) setIsSidebarOpen(false);
                }}
              >
                {link.icon} <span>{link.text}</span>
              </div>
            ))}
          </aside>
        )}

        {/* Main content */}
        <main className="dashboard-main">
          <NotificationListener />
          <Routes>
            <Route path="notifications" element={<Notifications token={token} user={user} />} />
            <Route path="profile" element={<Profile />} />
            <Route path="change-password" element={<ChangePassword />} />
            <Route path="dashboard" element={<Dashboard currentUser={user} />} />
            <Route path="dashboard/task/:id" element={<TaskEdit />} />
            <Route path="reminders" element={<Remainders currentUser={user} />} />
            <Route path="task-history/my-task-history" element={<TaskHistory />} />
            <Route path="statistics" element={<Statistics />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default EmployeeDashboard;
