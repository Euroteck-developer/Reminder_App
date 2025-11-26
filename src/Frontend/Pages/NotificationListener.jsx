import React, { useEffect, useState, useRef, useCallback } from "react";
import socket from "../Utils/Socket";
import { motion, AnimatePresence } from "framer-motion";
import { X, Bell, ListTodo, Flag } from "lucide-react";
import axios from "axios";
import API_URL from "../../Api/Config";
import "../Styles/NotificationListener.css";

const NotificationListener = () => {
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [showPendingPopup, setShowPendingPopup] = useState(false);
  const [showOverduePopup, setShowOverduePopup] = useState(false);
  const [showTasksPopup, setShowTasksPopup] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [taskType, setTaskType] = useState("");
  const [popupColorClass, setPopupColorClass] = useState("");
  const hasInitialized = useRef(false);

  const userId = parseInt(localStorage.getItem("user_id"));
  const token = localStorage.getItem("token");

  // HELPERS WITH useCallback

  const isUserLoggedIn = useCallback(() => {
    return !!(token && userId);
  }, [token, userId]);

  const setupSocketListeners = useCallback(() => {
    if (socket.hasListeners) return;
    socket.hasListeners = true;

    socket.on("connect", () => {
      if (userId) socket.emit("joinUserRoom", userId);
    });

    socket.on("newReminder", (data) => categorizeReminders([data]));
  }, [userId]);

  const connectSocketAfterLogin = useCallback(() => {
    if (!socket.connected) socket.connect();
    setupSocketListeners();
  }, [setupSocketListeners]);

  // FETCH REMINDERS
  const fetchReminders = useCallback(async () => {
    try {
      if (!token) return;
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      categorizeReminders(res.data);
    } catch (err) {
      console.error("Failed to fetch reminders:", err.message);
    }
  }, [token]);

  // CATEGORIZE REMINDERS
  const categorizeReminders = (reminders) => {
    const now = new Date();
    const activeReminders = reminders.filter(
      (r) => r.status?.toLowerCase() !== "completed"
    );

    const pending = activeReminders.filter((r) => {
      const target = new Date(r.extended_due_date || r.due_date);
      return target > now;
    });

    const overdue = activeReminders.filter((r) => {
      const target = new Date(r.extended_due_date || r.due_date);
      return target <= now;
    });

    setPendingCount(pending.length);
    setOverdueCount(overdue.length);

    if (pending.length > 0) setTimeout(() => setShowPendingPopup(true), 300);
    if (overdue.length > 0) setTimeout(() => setShowOverduePopup(true), 800);
  };

  // INITIAL LOAD
  useEffect(() => {
    if (!isUserLoggedIn()) return;

    const init = async () => {
      if (hasInitialized.current) return;
      hasInitialized.current = true;

      connectSocketAfterLogin();
      await fetchReminders();
    };

    init();

    return () => {
      socket.off("connect");
      socket.off("newReminder");
      socket.hasListeners = false;
    };
  }, [isUserLoggedIn, connectSocketAfterLogin, fetchReminders]);

  // FETCH TASKS BY TYPE
  const fetchTasksByType = async (type) => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/reminders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const now = new Date();

      const activeReminders = res.data.filter(
        (r) => r.status?.toLowerCase() !== "completed"
      );

      let filtered = [];
      if (type === "pending") {
        filtered = activeReminders.filter((r) => {
          const target = new Date(r.extended_due_date || r.due_date);
          return target > now;
        });
      } else if (type === "overdue") {
        filtered = activeReminders.filter((r) => {
          const target = new Date(r.extended_due_date || r.due_date);
          return target <= now;
        });
      }

      setTasks(filtered);
      setTaskType(type);
      setShowPendingPopup(false);
      setShowOverduePopup(false);

      const anySelf = filtered.some(
        (t) => t.assigned_to === userId && t.created_by === userId
      );
      const anyAssignedByUser = filtered.some(
        (t) => t.created_by === userId && t.assigned_to !== userId
      );

      if (anySelf) setPopupColorClass("reminder-green");
      else if (anyAssignedByUser) setPopupColorClass("reminder-orange");
      else setPopupColorClass("reminder-blue");

      setTimeout(() => setShowTasksPopup(true), 300);
    } catch (err) {
      console.error("Failed to fetch tasks:", err.message);
    }
  };

  // POPUP CLOSE HANDLERS
  const handleManualClose = (popupType) => {
    if (popupType === "pending") setShowPendingPopup(false);
    if (popupType === "overdue") setShowOverduePopup(false);

    setTimeout(() => {
      if (popupType === "pending" && pendingCount > 0)
        setShowPendingPopup(true);
      if (popupType === "overdue" && overdueCount > 0)
        setShowOverduePopup(true);
    }, 1000000);
  };

  const handleCloseTasksPopup = async () => {
    setShowTasksPopup(false);
    await fetchReminders();
  };

  const overlayActive =
    showPendingPopup || showOverduePopup || showTasksPopup;

  const getPriorityColorClass = (priority) => {
    switch ((priority || "").toLowerCase()) {
      case "high":
        return "flag-high";
      case "medium":
        return "flag-medium";
      case "low":
        return "flag-low";
      default:
        return "";
    }
  };

  return (
    <>
      {overlayActive && <div className="notification-overlay"></div>}

      <div className="notification-container">
        <AnimatePresence>
          {/* Pending Popup */}
          {showPendingPopup && pendingCount > 0 && (
            <motion.div
              key="pending"
              className="notification-modal reminder-blue"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="notification-header">
                <Bell className="bell-icon" size={24} />
                <button
                  className="close-btn"
                  onClick={() => handleManualClose("pending")}
                >
                  <X size={22} />
                </button>
              </div>
              <h1 className="notification-main-title">Pending Tasks</h1>
              <h2 className="notification-title">
                You have <b>{pendingCount}</b> pending{" "}
                {pendingCount === 1 ? "task" : "tasks"}.
              </h2>
              <p className="countdown-text">Complete them before due date.</p>
              <button
                className="view-tasks-btn"
                onClick={() => fetchTasksByType("pending")}
              >
                <ListTodo size={18} /> View Pending Tasks
              </button>
            </motion.div>
          )}

          {/* Overdue Popup */}
          {showOverduePopup && overdueCount > 0 && (
            <motion.div
              key="overdue"
              className="notification-modal reminder-red"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="notification-header">
                <Bell className="bell-icon" size={24} />
                <button
                  className="close-btn"
                  onClick={() => handleManualClose("overdue")}
                >
                  <X size={22} />
                </button>
              </div>
              <h1 className="notification-main-title">Overdue Tasks</h1>
              <h2 className="notification-title">
                You have <b>{overdueCount}</b> overdue{" "}
                {overdueCount === 1 ? "task" : "tasks"}.
              </h2>
              <p className="countdown-text">Please review your overdue tasks.</p>
              <button
                className="view-tasks-btn"
                onClick={() => fetchTasksByType("overdue")}
              >
                <ListTodo size={18} /> View Overdue Tasks
              </button>
            </motion.div>
          )}

          {/* Tasks Popup */}
          {showTasksPopup && (
            <motion.div
              key="tasksPopup"
              className={`notification-modal task-popup ${popupColorClass}`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            >
              <div className="notification-header">
                <ListTodo className="bell-icon" size={24} />
                <button className="close-btn" onClick={handleCloseTasksPopup}>
                  <X size={22} />
                </button>
              </div>
              <h1 className="notification-main-title">
                {taskType === "pending" ? "Pending Tasks" : "Overdue Tasks"}
              </h1>

              <div className="task-content">
                <ul className="task-list">
                  {tasks.map((task) => (
                    <li key={task.id} className="task-item">
                      <div className="task-title-row">
                        <strong>{task.task}</strong>
                        <Flag
                          size={18}
                          className={`priority-flag ${getPriorityColorClass(
                            task.priority
                          )}`}
                        />
                      </div>
                      <p>
                        Assigned by: <b>{task.created_by_name || "Unknown"}</b>
                      </p>
                      <p>
                        Assigned to:{" "}
                        <b>
                          {task.users && task.users.length
                            ? task.users.map((u) => u.name).join(", ")
                            : "Unassigned"}
                        </b>
                      </p>
                      <p>
                        Due: {new Date(task.due_date).toLocaleDateString()}
                        {task.extended_due_date && (
                          <span>
                            {" "}
                            | Extended:{" "}
                            {new Date(
                              task.extended_due_date
                            ).toLocaleDateString()}
                          </span>
                        )}
                      </p>
                      <p>
                        Status:{" "}
                        <b style={{ textTransform: "capitalize" }}>
                          {task.status}
                        </b>
                      </p>
                    </li>
                  ))}
                  {tasks.length === 0 && (
                    <p className="no-tasks">No {taskType} tasks found.</p>
                  )}
                </ul>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export default NotificationListener;
