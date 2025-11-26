import React, { useState, useEffect } from "react";
import { Routes, Route, useNavigate, Link } from "react-router-dom";
import {
  FaUserCircle,
  FaUserPlus,
  FaUsers,
  FaBell,
  FaTasks,
  FaChartBar,
  FaBars,
  FaTimes,
  FaHistory,
  FaArrowUp
} from "react-icons/fa";
import { BiSolidDashboard } from "react-icons/bi";
import NavLogo from "../Assets/EUROTECK LOGO.webp";
import ResNavIcon from "../Assets/EUROTECK ICON.webp";
import Profile from "../Pages/Profile";
import ChangePassword from "../Pages/ChangePassword";
import CreateUser from "./CreateUser";
import axios from "axios";
import "../Styles/Dashboard.css";
import UsersList from "./UsersList";
import Remainders from "../Pages/Remainders";
import Dashboard from "../Pages/Dashboard";
import TaskEdit from "../Pages/TaskEdit";
import Notifications from "../Pages/Notifications";
import API_URL from "../../Api/Config";
import NotificationListener from "../Pages/NotificationListener";
import TaskHistory from "../Pages/TaskHistory";
import Statistics from "../Pages/Statistics";

const SuperAdminDashboard = () => {
  const [user, setUser] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [activePage, setActivePage] = useState("Dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);

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

  // Show scroll-to-top after scrolling 600px
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 600) setShowScrollTop(true);
      else setShowScrollTop(false);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scoll to top smoothly
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };


  const sidebarLinks = [
    { icon: <BiSolidDashboard />, text: "Dashboard", path: "dashboard" },
    { icon: <FaUserPlus />, text: "Create User", path: "create-user" },
    { icon: <FaUsers />, text: "Users", path: "users" },
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
          <Link to="/superadmin-dashboard/notifications">
            <FaBell size={22} className="icon-btn" />
          </Link> 
          <div className="profile-wrapper" onClick={toggleProfile}>
            <FaUserCircle size={28} className="icon-btn" />
            {isProfileOpen && (
              <div className="profile-dropdown">
                <Link to="/superadmin-dashboard/profile">Profile</Link>
                <Link to="/superadmin-dashboard/change-password">Change Password</Link>
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
                  navigate(`/superadmin-dashboard/${link.path}`);
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
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="create-user" element={<CreateUser />} />
            <Route path="users" element={<UsersList />} />
            <Route path="reminders" element={<Remainders currentUser={user} />} />
            <Route path="dashboard/task/:id" element={<TaskEdit />} />
            <Route path="task-history/my-task-history" element={<TaskHistory />} />
            <Route path="statistics" element={<Statistics />} />
          </Routes>
        </main>
      </div>
      {/* Scroll to top button */}
      {showScrollTop && (
        <button
          className="scroll-top-btn"
          onClick={scrollToTop}
          title="Go to top"
        >
          <FaArrowUp />
        </button>
      )}
    </div>
  );
};

export default SuperAdminDashboard;

