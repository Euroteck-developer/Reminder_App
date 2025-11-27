import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import API_URL from "../../Api/Config";
import { toast } from "react-toastify";

const SelfReminder = ({ taskId, taskStatus }) => {
  const [reminderDate, setReminderDate] = useState(null);
  const [reminders, setReminders] = useState([]);
  const token = localStorage.getItem("token");

  // Fetch Reminder
  const fetchReminder = useCallback(async () => {
    if (!taskId) return;

    try {
      const res = await axios.get(`${API_URL}/api/self-reminder/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = res.data;
      setReminders(data ? [data] : []);
    } catch (err) {
      console.log("Fetch error:", err);
      setReminders([]);
    }
  }, [taskId, token]);

  useEffect(() => {
    if (!taskId || taskStatus === "completed") return;

    fetchReminder();
    
    // Auto update of self reminder status either send or pending (Update without page refreshing after 5sec)
    const interval = setInterval(fetchReminder, 5000);
    return () => clearInterval(interval);

  }, [taskId, taskStatus, fetchReminder]);

  // Save Reminder
  const saveReminder = async () => {
    if (!reminderDate) {
      toast.error("Please select a reminder date");
      return;
    }

    try {
      await axios.post(
        `${API_URL}/api/self-reminder/save`,
        {
          taskId,
          reminder_datetime: reminderDate,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      toast.success("Reminder saved");
      setReminderDate(null);
      fetchReminder();
    } catch (err) {
      console.log("Save error:", err);
      toast.error("Failed to save reminder");
    }
  };

  // Self reminder component will not be displayed when task status is completed
  if (!taskStatus || taskStatus.toLowerCase() === "completed") {
    return null;
  }

  return (
    <div className="p-3 border rounded bg-white shadow-sm mt-3">
      <h5 className="fw-bold">Self Reminder</h5>

      <div className="d-flex gap-3 align-items-center mt-3">
        <DatePicker
          selected={reminderDate}
          onChange={(date) => setReminderDate(date)}
          showTimeSelect
          dateFormat="dd/MM/yyyy h:mm aa"
          className="form-control"
          placeholderText="Select reminder date"
        />

        <button className="btn btn-primary" onClick={saveReminder}>
          Save
        </button>
      </div>

      <h6 className="mt-4">Scheduled Reminder</h6>

      <ul className="list-group">
        {reminders.length === 0 ? (
          <p className="text-muted">No reminder set</p>
        ) : (
          reminders.map((r, idx) => (
            <li
              key={idx}
              className="list-group-item d-flex justify-content-between"
            >
              {new Date(r.reminder_datetime).toLocaleString()}
              <span
                className={`badge ${r.sent === 1 ? "bg-success" : "bg-warning"}`}
              >
                {r.sent === 1 ? "Sent" : "Pending"}
              </span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default SelfReminder;
