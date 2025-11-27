import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import API_URL from "../../Api/Config";
import "../Styles/SideDashboard.css";
import { FaTrash } from "react-icons/fa";
import { Modal } from "react-bootstrap";

// Priority Badge Component
const PriorityBadge = ({ level }) => {
  const colors = { High: "#dc3545", Medium: "#ffc107", Low: "#28a745" };
  return (
    <span
      style={{
        backgroundColor: colors[level] || "#6c757d",
        color: level === "Medium" ? "#000" : "#fff",
        padding: "4px 10px",
        borderRadius: "6px",
        fontSize: "0.85rem",
        fontWeight: "bold",
      }}
    >
      {level}
    </span>
  );
};

const Dashboard = () => {
  const [tasks, setTasks] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [activeTab, setActiveTab] = useState("tasks");
  const [selectedType, setSelectedType] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [meetingStatusFilter, setMeetingStatusFilter] = useState("all");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;

  const token = localStorage.getItem("token");
  const navigate = useNavigate();

  // Reset Pagination when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedStatus]);

  // Fetch user, tasks, and meetings
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const userRes = await axios.get(`${API_URL}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const loggedUser = userRes.data;
        setUser(loggedUser);
        
        const [tasksRes, meetingsRes] = await Promise.all([
          axios.get(`${API_URL}/api/reminders`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/api/meetings`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        
        // Tasks filtering logic
        const allTasks = tasksRes.data || [];
        const roleId = Number(loggedUser.role_id); // ensure it's a number
        let filteredTasks = [];
        
        // Admin, Managing Director, Director - show all
        if ([1, 2, 3].includes(roleId)) {
          // console.log("Admin-level role detected, showing all tasks");
          filteredTasks = allTasks;
        }
        // Manager - show created or assigned
        else if (roleId === 4) {
          filteredTasks = allTasks.filter(
            (t) =>
              t.created_by_id === loggedUser.id ||
              t.users?.some((u) => u.id === loggedUser.id)
          );
        }
        // Regular employee - show only their tasks
        else {
          filteredTasks = allTasks.filter(
           (t) =>
              t.created_by_id === loggedUser.id ||
              t.users?.some((u) => u.id === loggedUser.id)
          );
        }
        setTasks(filteredTasks);
        
        // Meetings handling
        if (Array.isArray(meetingsRes.data.meetings)) {
          setMeetings(meetingsRes.data.meetings);
          
          if (meetingsRes.data.meetings.length === 0) {
            toast.info(
              meetingsRes.data.message ||
              "No meetings have been created for your email or department."
            );
          }
        } else if (Array.isArray(meetingsRes.data)) {
            // For backward compatibility if backend still returns [] directly
            setMeetings(meetingsRes.data);
          } else {
            setMeetings([]);
            toast.info(
              meetingsRes.data?.message ||
              "No meetings have been created for your email or department."
            );
          }
        } catch (error) {
          console.error(error);
          if (error.response?.status === 401) {
            toast.error("Session expired. Please log in again.");
            localStorage.clear();
            navigate("/");
          } else {
            toast.error("Failed to load dashboard data");
          }
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }, [token, navigate]);
    
    const handleDeleteMeeting = (meetingId) => {
      setDeleteTarget(meetingId);
      setShowDeleteModal(true);
    };

    const confirmDeleteMeeting = async () => {
      if (!deleteTarget) return;
        setDeleting(true);
        try {
          await axios.delete(`${API_URL}/api/meetings/${deleteTarget}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          setMeetings((prev) => prev.filter((m) => m.id !== deleteTarget));
          toast.success("Meeting deleted successfully!");
         setShowDeleteModal(false);
        } catch (error) {
        console.error(error);
        toast.error("Failed to delete meeting");
      } finally {
        setDeleting(false);
    }
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (!user) return null;
  
  // Filter tasks
  const allTasks = tasks.filter(
    (t) =>
      t.created_by_id === user.id ||
      t.users?.some((u) => u.id === user.id)
  );

  // Tasks CREATED by the user
  const createdTasks = tasks.filter(
    (t) => t.created_by_id === user.id
  );

  // Tasks ASSIGNED TO THE USER by someone else
  const assignedTasks = tasks.filter(
    (t) =>
      t.created_by_id !== user.id && // someone else created it
      t.users?.some((u) => u.id === user.id) // but assigned to me
  );

  // PERSONAL tasks (created by me → assigned to only me)
  const personalTasks = tasks.filter(
    (t) =>
      t.created_by_id === user.id &&
      t.users?.length === 1 &&
      t.users[0].id === user.id
  );

  let displayedTasks =
  selectedType === "created"
  ? createdTasks
  : selectedType === "assigned"
  ? assignedTasks
  : selectedType === "personal"
  ? personalTasks
  : allTasks;

  if (selectedStatus !== "all") {
    displayedTasks = displayedTasks.filter(
      (t) => t.status?.toLowerCase() === selectedStatus
    );
  }

  if (searchQuery) {
    displayedTasks = displayedTasks.filter((t) =>
      t.task?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // Task pagination
  const totalPagesTasks = Math.ceil(displayedTasks.length / itemsPerPage);
  const paginatedTasks = displayedTasks.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Task summary
    const totalTasks = allTasks.length;
    const pending = allTasks.filter(
      (t) => t.status?.toLowerCase() === "pending"
    ).length;
    const inProgress = allTasks.filter(
      (t) => t.status?.toLowerCase() === "in progress"
    ).length;
    const completed = allTasks.filter(
      (t) => t.status?.toLowerCase() === "completed"
    ).length;

  // Meeting filters and pagination
  let displayedMeetings = [...meetings];
  if (meetingStatusFilter !== "all") {
    displayedMeetings = displayedMeetings.filter(
      (m) => m.status?.toLowerCase() === meetingStatusFilter
    );
  }

  if (searchQuery) {
    displayedMeetings = displayedMeetings.filter((m) =>
      m.description?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  const totalPagesMeetings = Math.ceil(displayedMeetings.length / itemsPerPage);
  const paginatedMeetings = displayedMeetings.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const allMeetings = meetings;
  const totalMeetings = allMeetings.length;
  const pendingMeetings = allMeetings.filter(
    (m) => m.status?.toLowerCase() === "pending"
  ).length;
  const completedMeetings = allMeetings.filter(
    (m) => m.status?.toLowerCase() === "completed"
  ).length;
  const cancelledMeetings = allMeetings.filter(
    (m) => m.status?.toLowerCase() === "cancelled"
  ).length;

  const handlePageChange = (page) => setCurrentPage(page);

  // Update meeting status
  const handleStatusChange = async (meetingId, newStatus) => {
    try {
      await axios.put(
        `${API_URL}/api/meetings/status`,
        { meetingId, status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMeetings((prev) =>
        prev.map((m) =>
          m.id === meetingId ? { ...m, status: newStatus } : m
        )
      );
      toast.success("Meeting status updated!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to update status");
    }
  };

  // Pagination UI
  const renderPagination = (totalPages) => (
    <div
      className="d-flex flex-wrap justify-content-center align-items-center mt-3 gap-2"
      style={{ rowGap: "0.5rem" }}
    >
      <button
        className="btn btn-outline-secondary btn-sm"
        disabled={currentPage === 1}
        onClick={() => handlePageChange(currentPage - 1)}
      >
        Prev
      </button>
      
      {/* Show max 5 page numbers with ellipsis */}
      {(() => {
        const visiblePages = [];
        const maxVisible = 5;

        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start < maxVisible - 1) {
          start = Math.max(1, end - maxVisible + 1);
        }

        if (start > 1) visiblePages.push("...");
        for (let i = start; i <= end; i++) visiblePages.push(i);
        if (end < totalPages) visiblePages.push("...");

        return visiblePages.map((page, i) =>
          page === "..." ? (
            <span key={i} className="fw-semibold px-2">
              ...
            </span>
            ) : (
              <button
                key={i}
                className={`btn btn-sm ${
                  currentPage === page ? "btn-primary" : "btn-outline-secondary"
                }`}
                onClick={() => handlePageChange(page)}
              >  
                {page}
              </button>
            )
          );
        })()}
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(currentPage + 1)}
        >
          Next
        </button>
    </div>
  );

  // Task Table
  const renderTaskTable = (list) => (
    <div className="table-wrapper">
      <table className="custom-table">
        <thead>
          <tr>
            <th>S.No</th>
            <th>Task</th>
            <th>Assigned Date</th>
            <th>Due Date</th>
            <th>Extended Due</th>
            <th>Assigned By</th>
            <th>Assigned To</th>
            <th>Priority</th>
            <th>Status</th>
            <th>Status Desc</th>
            <th>Last Updated</th>
          </tr>
        </thead>
        <tbody>
          {list.length > 0 ? (
            list.map((task, idx) => {
              const isCompleted = task.status?.toLowerCase() === "completed";
              const isOverdue =
                new Date(task.extended_due_date || task.due_date) < new Date();

              return (
                <tr
                  key={task.id}
                  className={
                    isCompleted
                      ? "table-success"
                      : isOverdue
                      ? "blinking-red"
                      : ""
                  }
                >
                  <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td>
                    <Link
                      to={`task/${task.id}`}
                      style={{
                        color: "#007bff",
                        textDecoration: "underline",
                        cursor: "pointer",
                        fontWeight: "500",
                      }}
                    >
                      {task.task.length > 20 ? `${task.task.slice(0, 30)}...` : task.task}
                    </Link>
                  </td>
                  <td>{new Date(task.assigned_date).toLocaleString()}</td>
                  <td>{new Date(task.due_date).toLocaleString()}</td>
                  <td>
                    {task.extended_due_date
                      ? new Date(task.extended_due_date).toLocaleString()
                      : "-"}
                  </td>
                  <td>{task.created_by?.name || "-"}</td>
                  <td>
                    {task.users?.length
                      ? task.users.map((u) => u.name).join(", ")
                      : "-"}
                  </td>
                  <td>
                    <PriorityBadge level={task.priority} />
                  </td>
                  <td>{task.status || "-"}</td>
                  <td>{task.status_desc || "-"}</td>
                  <td>
                    {task.last_updated
                      ? new Date(task.last_updated).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan="11" className="text-center">
                No tasks found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="pagination-wrapper">
        {renderPagination(totalPagesTasks)}
      </div>
    </div>
    
  );

  // Meeting Table
  const renderMeetingTable = (list) => (
    <div className="table-wrapper">
      {list.length > 0 ? (
        <>
          <table className="custom-table">
            <thead>
              <tr>
                <th>S.No</th>
                <th>Description</th>
                <th>Date & Time</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created By</th>
                <th>Participants</th>
                <th>Departments</th>
                {/* Show Actions column only for role_id 1, 2, or 3 */}
                {(user?.role_id === 1 || user?.role_id === 2 || user?.role_id === 3) && (
                  <th>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {list.map((meeting, idx) => (
                <tr key={meeting.id}>
                  <td>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                  <td>{meeting.description}</td>
                  <td>{new Date(meeting.date).toLocaleString()}</td>
                  <td>
                    <PriorityBadge level={meeting.priority} />
                  </td>
                  <td>
                    <select
                      className="form-select"
                      style={{ width: "130px" }}
                      value={meeting.status || "Pending"}
                      disabled={(meeting.created_by_id) !== (user.id)}
                      onChange={(e) =>
                        handleStatusChange(meeting.id, e.target.value)
                      }
                    >
                      <option value="Pending">Pending</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </td>
                  <td>{meeting.created_by_name || "-"}</td>
                  <td>
                    {meeting.users?.length
                      ? meeting.users.map((u) => u.name).join(", ")
                      : "-"}
                  </td>
                  <td>
                    {meeting.departments?.length
                      ? meeting.departments.join(", ")
                      : "-"}
                  </td>
                  {/* Show delete button only for role_id 1, 2, 3 */}
                  {(user?.role_id === 1 || user?.role_id === 2 || user?.role_id === 3) && (
                    <td>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        title="Delete Meeting"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "4px",
                        }}
                      >
                        <FaTrash />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pagination-wrapper">
            {renderPagination(totalPagesMeetings)}
          </div>
        </>
        ) : (
          <div
            className="text-center p-5 bg-light border rounded shadow-sm mt-4"
            style={{ fontSize: "1.1rem", color: "#555" }}
          >
            <i className="bi bi-calendar-x fs-2 d-block mb-2"></i>
              No meetings have been created for your email or department.
          </div>
        )}
      </div>
    );
    
    // Main JSX
    return (
      <div className="container mt-4">
        {/* Tabs */}
        <div className="tabs mb-4">
          <button
            className={`tab-btn ${activeTab === "tasks" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("tasks");
              setCurrentPage(1);
            }}
          >
            Tasks
          </button>
          <button
            className={`tab-btn ${activeTab === "meetings" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("meetings");
              setCurrentPage(1);
            }}
          >
            Meetings
          </button>
        </div>
        {/* Task or Meeting Content */}
        {activeTab === "tasks" ? (
          <>
            {/* Task Summary Cards */}
            <div className="d-flex justify-content-around mb-4 flex-wrap gap-2">
              <div
                className={`summary-card blue ${
                  selectedStatus === "all" ? "active" : ""
                }`}
                onClick={() => setSelectedStatus("all")}
              >
                <h5>Total</h5>
                <h2>{totalTasks}</h2>
              </div>
              <div
                className={`summary-card yellow ${
                  selectedStatus === "pending" ? "active" : ""
                }`}
                onClick={() => setSelectedStatus("pending")}
              >
                <h5>Pending</h5>
                <h2>{pending}</h2>
              </div>
              <div
                className={`summary-card red ${
                  selectedStatus === "in progress" ? "active" : ""
                }`}
                onClick={() => setSelectedStatus("in progress")}
              >
                <h5>In Progress</h5>
                <h2>{inProgress}</h2>
              </div>
              <div
                className={`summary-card green ${
                  selectedStatus === "completed" ? "active" : ""
                }`}
                onClick={() => setSelectedStatus("completed")}
              >
                <h5>Completed</h5>
                <h2>{completed}</h2>
              </div>
            </div>
            <div className="d-flex justify-content-end mb-3 gap-3">
              <div className="d-flex justify-content-between align-items-center">
                <select
                  className="form-select w-auto"
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                >
                  <option value="all">All Tasks</option>
                  <option value="assigned">Assigned Tasks</option>
                  <option value="created">Created Tasks</option>
                  <option value="personal">Personal Tasks</option>
                </select>
              </div>
              <input
                type="text"
                className="form-control w-25"
                placeholder={`Search ${
                  activeTab === "tasks" ? "tasks" : "meetings"
                }...`}
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="pagination-wrapper">
              {renderTaskTable(paginatedTasks)}
            </div>
          </>
          ) : (
            <>
              {/* Meeting Summary Cards */}
              <div className="d-flex justify-content-around mb-4 flex-wrap gap-2">
                <div
                  className={`summary-card blue ${
                    meetingStatusFilter === "all" ? "active" : ""
                  }`}
                  onClick={() => setMeetingStatusFilter("all")}
                >
                  <h5>Total</h5>
                  <h2>{totalMeetings}</h2>
                </div>
                <div
                  className={`summary-card yellow ${
                  meetingStatusFilter === "pending" ? "active" : ""
                }`}
                onClick={() => setMeetingStatusFilter("pending")}
              >
                <h5>Pending</h5>
                <h2>{pendingMeetings}</h2>
              </div>
              <div
                className={`summary-card green ${
                  meetingStatusFilter === "completed" ? "active" : ""
                }`}
                onClick={() => setMeetingStatusFilter("completed")}
              >
                <h5>Completed</h5>
                <h2>{completedMeetings}</h2>
              </div>
              <div
                className={`summary-card red ${
                  meetingStatusFilter === "cancelled" ? "active" : ""
                }`}
                onClick={() => setMeetingStatusFilter("cancelled")}
              >
                <h5>Cancelled</h5>
                <h2>{cancelledMeetings}</h2>
              </div>
            </div>
            <div className="pagination-wrapper">
              {renderMeetingTable(paginatedMeetings)}
            </div>
          </>
        )}
        {/* Delete Confirmation Modal */}
        <Modal
          show={showDeleteModal}
          onHide={() => setShowDeleteModal(false)}
          centered
          backdrop="static"
        >
          <Modal.Header closeButton>
            <Modal.Title>Confirm Delete</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to delete this meeting?</p>
          </Modal.Body>
          <Modal.Footer>
            <button
              className="btn btn-secondary"
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              className="btn btn-danger"
              onClick={confirmDeleteMeeting}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  };

export default Dashboard;

