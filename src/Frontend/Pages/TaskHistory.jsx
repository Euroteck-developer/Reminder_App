import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import API_URL from "../../Api/Config";

const ITEMS_PER_PAGE = 10;

const TaskHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const token = localStorage.getItem("token");

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/reminders/history/user`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        let data = res.data.data || [];
        // Remove Lost records if that same task+user has a later "Reassigned" entry
        const reassignedMap = new Map();
        
        data.forEach((h) => {
          if (h.status === "Reassigned") {
            const key = `${h.task_id}-${h.user_id}`;
            const existing = reassignedMap.get(key);
            // Keep latest reassigned timestamp
            if (!existing || new Date(h.changed_at) > new Date(existing.changed_at)) {
              reassignedMap.set(key, h);
            }
          }
        });
        
        data = data.filter((h) => {
          if (h.status === "Lost") {
            const key = `${h.task_id}-${h.user_id}`;
            const reassign = reassignedMap.get(key);
            if (reassign && new Date(h.changed_at) < new Date(reassign.changed_at)) {
              return false;
            }
          }
          return true;
        });
        setHistory(data);
      } catch (err) {
        console.error(err);
        toast.error("Failed to fetch your task history");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token]);

  // Filter by status
  const handleFilter = (status) => {
    setActiveStatus(status);
    setCurrentPage(1);
  };

  // Filter + Search logic
  const displayedData = useMemo(() => {
    let data = [...history];

    if (activeStatus !== "All") {
      data = data.filter((h) => h.status === activeStatus);
    }

    if (search.trim() !== "") {
      const query = search.toLowerCase();
      data = data.filter(
        (h) =>
          h.task_description?.toLowerCase().includes(query) ||
          h.user_name?.toLowerCase().includes(query) ||
          h.changed_by_name?.toLowerCase().includes(query)
      );
    }

    return data;
  }, [history, activeStatus, search]);

  // Pagination Logic
  const totalPages = Math.ceil(displayedData.length / ITEMS_PER_PAGE);
  const paginatedData = displayedData.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  // Count Summary
  const counts = useMemo(() => {
    const summary = {
      All: history.length,
      New: 0,
      Old: 0,
      Lost: 0,
      Reassigned: 0,
    };
    history.forEach((h) => {
      if (summary[h.status] !== undefined) summary[h.status]++;
    });
    return summary;
  }, [history]);

  if (loading)
    return <div className="text-center mt-5">Loading your task history...</div>;

  return (
    <div className="container mt-4">
      <h4 className="mb-3 fw-bold text-center text-md-start">
        Task History
      </h4>

      {/* Summary Cards */}
      <div className="row g-3 mb-4">
        {["All", "New", "Old", "Lost", "Reassigned"].map((status) => {
          const colors = {
            All: "bg-primary",
            New: "bg-success",
            Old: "bg-warning text-dark",
            Lost: "bg-danger",
            Reassigned: "bg-info text-dark",
          };
          return (
            <div key={status} className="col-6 col-md-3 col-lg-2">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`card text-white ${colors[status]} shadow-sm cursor-pointer`}
                onClick={() => handleFilter(status)}
              >
                <div className="card-body text-center py-3" style={{ whiteSpace: "nowrap"}}>
                  <h6 className="mb-1">{status}</h6>
                  <h4 className="fw-bold mb-0">{counts[status]}</h4>
                </div>
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Search + Tabs */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-3">
        {/* Filter Tabs */}
        <div className="d-flex gap-3 border-bottom pb-2 flex-wrap">
          {["All", "New", "Old", "Lost", "Reassigned"].map((status) => (
            <div
              key={status}
              className="position-relative"
              style={{ cursor: "pointer" }}
              onClick={() => handleFilter(status)}
            >
              <span
                className={`fw-semibold ${
                  activeStatus === status ? "text-primary" : "text-secondary"
                }`}
              >
                {status}
              </span>
              {activeStatus === status && (
                <motion.div
                  layoutId="underline"
                  className="position-absolute start-0 end-0"
                  style={{
                    height: "3px",
                    backgroundColor: "#0d6efd",
                    bottom: "-6px",
                    borderRadius: "3px",
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Search Bar */}
        <input
          type="text"
          className="form-control w-50 w-md-auto"
          placeholder="Search task, user, or assigner..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeStatus + search + currentPage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
        >
          {paginatedData.length === 0 ? (
            <div className="alert alert-info text-center">
              No {activeStatus} tasks found
            </div>
          ) : (
            <div className="table-responsive shadow-sm rounded-3">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>S.No</th>
                    <th>Task Description</th>
                    <th>Assigned By</th>
                    <th>Assigned To</th>
                    <th>Changed At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((item, index) => (
                    <motion.tr
                      key={`${item.task_id}-${item.user_id}-${index}`}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <td>
                        {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                      </td>
                      <td>{item.task_description
                         ? item.task_description.length > 30
                          ? item.task_description.substring(0, 20) + "..."
                          : item.task_description
                          : "-"
                        }
                      </td>
                      <td>{item.changed_by_name || "-"}</td>
                      <td>{item.user_name || "-"}</td>
                      <td>
                        {new Date(item.changed_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === "New"
                              ? "bg-success"
                              : item.status === "Old"
                              ? "bg-warning text-dark"
                              : item.status === "Lost"
                              ? "bg-danger"
                              : "bg-info text-dark"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="d-flex justify-content-center align-items-center mt-3 flex-wrap gap-2">
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={currentPage === 1}
            onClick={() => handlePageChange(currentPage - 1)}
          >
            Prev
          </button>
          {[...Array(totalPages)].map((_, i) => (
            <button
              key={i}
              className={`btn btn-sm ${
                currentPage === i + 1
                  ? "btn-primary text-white"
                  : "btn-outline-primary"
              }`}
              onClick={() => handlePageChange(i + 1)}
            >
              {i + 1}
            </button>
          ))}
          <button
            className="btn btn-outline-primary btn-sm"
            disabled={currentPage === totalPages}
            onClick={() => handlePageChange(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default TaskHistory;
