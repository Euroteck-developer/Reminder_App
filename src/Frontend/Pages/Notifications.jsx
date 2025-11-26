import React, { useEffect, useState, } from "react";
import axios from "axios";
import API_URL from "../../Api/Config";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import "react-toastify/dist/ReactToastify.css";

const Notifications = ({ token, user }) => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const isManager = ["manager", "managing_director", "director", "superadmin"].includes(
    user?.role?.toLowerCase()
  );
  
  // Fetch notifications
  useEffect(() => {
    const token = localStorage.getItem("token");   

    const fetchNotifications = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setNotifications(res.data);
      } catch (err) {
        toast.error("Failed to fetch notifications");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, []);

  // Mark notification opened
  const handleOpen = async (id) => {
    try {
      // console.log(" Opening notification:", id);
      await axios.put(`${process.env.REACT_APP_API_URL}/api/notifications/${id}/opened`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

    } catch (err) {
      toast.error("Failed to open notification");
      console.error(err);
    }
  };

  // Mark notification read
  const handleRead = async (id) => {
    try {
      // console.log(" Reading notification:", id);
      const readAt = new Date().toISOString();

      await axios.put(`${process.env.REACT_APP_API_URL}/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: 1, read_at: readAt } : n
        )
      );
      toast.success("Marked as read");
    } catch (err) {
      toast.error("Failed to mark as read");
      console.error(err);
    }
  };

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ maxWidth: 700, margin: "30px auto", background: "#fff", padding: 20, borderRadius: 12 }}>
      <h2 style={{ color: "#007bff" }}> Notifications</h2>
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            onClick={() => handleOpen(n.id)}
            style={{
              padding: 15,
              background: n.is_read ? "#f8f9fa" : "#e7f1ff",
              borderRadius: 8,
              marginBottom: 10,
              position: "relative",
            }}
          >
            <strong>{n.title}</strong>
            <p>
              {n.message && n.message.length > 60
                ? `${n.message.substring(0, 60)}...`
                : n.message
              }
            </p>

            {/* Tick Marks for Manager */}
            {isManager && (
              <div style={{ position: "absolute", right: 10, top: 10 }}>
                {n.is_read ? (
                  <span style={{ color: "#0d6efd" }}>✔✔</span> // blue
                ) : n.opened_by_user ? (
                  <span style={{ color: "#6c757d" }}>✔✔</span> // gray
                ) : (
                  <span style={{ color: "#6c757d" }}>✔</span> // single gray
                )}
              </div>
            )}

            {/* Mark as Read (for non-managers) */}
            {!isManager && !n.is_read && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleRead(n.id);
                }}
                style={{
                  marginTop: 8,
                  background: "#007bff",
                  color: "#fff",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Mark as Read
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default Notifications;
