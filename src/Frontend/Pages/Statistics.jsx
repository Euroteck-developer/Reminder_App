import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import API_URL from "../../Api/Config";
import { toast } from "react-toastify";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#00C49F", "#FF8042", "#A0AEC0"];

const Statistics = () => {

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("assigned");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const token = localStorage.getItem("token") || null;
  const rawRole = localStorage.getItem("role_id");
  const roleId = rawRole ? parseInt(rawRole, 10) : null;

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const truncateText = (text = "", limit = 20) =>
    text.length > limit ? text.substring(0, limit).trim() + "..." : text;

  // helper: allowed types per role
  const getAvailableTypes = useCallback(() => {
    switch (Number(roleId)) {
      case 1:
      case 2:
      case 3:
        return ["assigned", "personal", "created", "all"];
      case 4:
        return ["personal", "assigned", "created"];
      case 5:
        return ["personal", "assigned"];
      default:
        return ["assigned"];
    }
  }, [roleId]);
  
  const availableTypes = getAvailableTypes();
  
  useEffect(() => {
    const allowed = getAvailableTypes();
    if (!allowed.includes(type)) {
      const fallback = allowed.includes("assigned") ? "assigned" : allowed[0];
      setType(fallback);
    }
  }, [roleId, type, getAvailableTypes]);

  // fetch users (admin only)
  // const fetchUsers = useCallback(async () => {
  //   if (!token) return;
  //   try {
  //     const res = await axios.get(`${API_URL}/api/users/all-users`, {
  //       headers: { Authorization: `Bearer ${token}` },
  //     });
  //     setUsers(res.data || []);
  //   } catch (err) {
  //     console.error("Users Error:", err);
  //     toast.error("Failed to load users");
  //   }
  // }, [token]);

  // fetch users (admin only)
  const fetchUsers = useCallback(async () => {
    if (!token) return;

    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/api/users/all-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      let list = res.data || [];

      // Super Admin (role_id = 1) → hide MD (2) and Director (3)
      if (Number(roleId) === 1) {
        list = list.filter((u) => ![2, 3].includes(Number(u.role_id)));
      }

      setUsers(list);
    } catch (err) {
      console.error("Users Error:", err);
      toast.error("Failed to load users");
    }
  }, [token, roleId]);

  // fetch stats
  const fetchStats = useCallback(async () => {
    // don't call until token and roleId ready
    if (!token || !roleId || isNaN(roleId)) return;

    try {
      setLoading(true);

      let url = `${process.env.REACT_APP_API_URL}/api/stats/user-performance?type=${encodeURIComponent(
        type
      )}`;

      if ([1, 2, 3].includes(roleId)) {
        if (type !== "all") {
          if (selectedUser) {
            url += `&userId=${encodeURIComponent(selectedUser)}`;
          } else {
            // ensure backend receives a userId (avoid undefined)
            url += `&userId=self`;
          }
        } // if type === 'all' => don't append userId
      } else {
        // employees / other roles: always self
        url += `&userId=self`;
      }

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Expect backend to return { success: true, completed, lost, pending, data: [...] }
      setStats(res.data);
      setCurrentPage(1);
    } catch (err) {
      console.error("Stats Error:", err);
      if (err?.response?.status === 403) {
        toast.error("Access denied for this view");
      } else {
        toast.error("Failed to fetch performance stats");
      }
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [type, selectedUser, roleId, token]);

  // load users if admin
  useEffect(() => {
    if (!token || !roleId || isNaN(roleId)) return;
    if ([1, 2, 3].includes(roleId)) {
      fetchUsers();
    } else {
      setUsers([]); // ensure users list is empty for non-admins
      setSelectedUser(""); // clear any selectedUser for employees
    }
  }, [roleId, token, fetchUsers]);

  // main fetch: run only when role and token are ready and when type/selectedUser changes
  useEffect(() => {
    if (!token || !roleId || isNaN(roleId)) return;
    fetchStats();
  }, [roleId, token, type, selectedUser, fetchStats]);

  // reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  // data 
  const chartData = stats
    ? [
        { name: "Completed", value: stats.completed || 0 },
        { name: "Lost", value: stats.lost || 0 },
        { name: "Pending", value: stats.pending || 0 },
      ]
    : [];

  const barData = stats
    ? [
        {
          name: "Tasks",
          Completed: stats.completed ?? 0,
          Lost: stats.lost ?? 0,
          Pending: stats.pending ?? 0,
        },
      ]
    : [];

  const filteredTasks =
    stats?.data?.filter((t) => {
      const matchesSearch =
        (t.description || "")
          .toLowerCase()
          .includes((search || "").toLowerCase()) ||
        (t.performance_status || "")
          .toLowerCase()
          .includes((search || "").toLowerCase());

      const matchesStatus =
        statusFilter === "All" || t.performance_status === statusFilter;

      return matchesSearch && matchesStatus;
    }) || [];

  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedTasks = filteredTasks.slice(
    startIndex,
    startIndex + ITEMS_PER_PAGE
  );

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) setCurrentPage(page);
  };

  return (
    <div className="container mt-4">
      <h4 className="fw-bold mb-4 text-center">Task Performance Statistics</h4>

      {/* Filters */}
      <div className="d-flex justify-content-center mb-4 flex-wrap gap-2">
        <select
          className="form-select w-auto"
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            // if admin switches to 'all', clear selectedUser; else keep it
            if (e.target.value === "all") setSelectedUser("");
          }}
        >
          {availableTypes.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)} Tasks
            </option>
          ))}
        </select>

        {/* user selector visible only to admins */}
        {[1, 2, 3].includes(roleId) && (
          <select
            className="form-select w-auto"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
          >
            <option value="">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="text-center mt-5">Loading statistics...</div>
      ) : !stats ? (
        <div className="alert alert-info text-center">No data available</div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="row g-3 mb-4 text-center">
            {[
              {
                title: "Total",
                value: (stats.completed || 0) + (stats.lost || 0) + (stats.pending || 0),
                color: "text-primary",
              },
              { title: "Completed", value: stats.completed || 0, color: "text-success" },
              { title: "Lost", value: stats.lost || 0, color: "text-danger" },
              { title: "Pending", value: stats.pending || 0, color: "text-secondary" },
              {
                title: "Overall Performance",
                value: `${stats.performancePercentage || 0}%`,
                color: "text-primary",
              },
            ].map((c, i) => (
              <div key={i} className="col-lg-3 col-md-6 col-6">
                <div className="card shadow-sm border-0 h-100">
                  <div className="card-body">
                    <h6 className={c.color}>{c.title}</h6>
                    <h5 className="fw-bold">{c.value}</h5>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="row">
            <div className="col-lg-6 col-md-12 mb-4">
              <div className="card shadow-sm p-3 h-100">
                <h6 className="text-center mb-3 fw-semibold">Task Distribution (Pie)</h6>
                <div style={{ width: "100%", height: "280px" }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={chartData} cx="50%" cy="50%" outerRadius="80%" dataKey="value">
                        {chartData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="col-lg-6 col-md-12 mb-4">
              <div className="card shadow-sm p-3 h-100">
                <h6 className="text-center mb-3 fw-semibold">Performance Overview (Bar)</h6>
                <div style={{ width: "100%", height: "280px" }}>
                  <ResponsiveContainer>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis
                        domain={[0, Math.ceil(stats.totalTasks / 5) * 5]}  
                        ticks={
                          Array.from(
                           { length: Math.ceil(stats.totalTasks / 5) + 1 },
                           (_, i) => i * 5
                          )
                        }
                      />

                      <Tooltip />
                      <Legend />

                      <Bar dataKey="Completed" fill="#00C49F" />
                      <Bar dataKey="Lost" fill="#FF8042" />
                      <Bar dataKey="Pending" fill="#A0AEC0" />
                    </BarChart>
                  </ResponsiveContainer>

                </div>
              </div>
            </div>
          </div>

          {/* Task Table */}
          <div className="mt-4">
            <h5 className="fw-semibold mb-3">Task Details</h5>

            <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 gap-2">
              <input
                type="text"
                placeholder="Search task or status..."
                className="form-control w-auto flex-grow-1"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <select
                className="form-select w-auto"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
                <option value="Lost">Lost</option>
              </select>
            </div>

            <div className="table-responsive shadow-sm rounded">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-dark">
                  <tr>
                    <th>S.No</th>
                    <th>Task</th>
                    <th>Assigned By</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTasks.length > 0 ? (
                    paginatedTasks.map((task, i) => (
                      <tr key={`${task.task_id}-${i}`}>
                        <td>{startIndex + i + 1}</td>
                        <td>{truncateText(task.description || "-", 20)}</td>
                        <td>{task.created_by_name}</td>
                        <td>{task.assigned_to_name}</td>
                        <td>
                          <span
                            className={`badge ${
                              task.performance_status === "Completed"
                                ? "bg-success"
                                : task.performance_status === "Lost"
                                ? "bg-danger"
                                : "bg-secondary"
                            }`}
                          >
                            {task.performance_status}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="text-center">
                        No tasks found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="d-flex justify-content-center align-items-center mt-3 gap-2">
                <button
                  className="btn btn-outline-primary btn-sm"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                >
                  Prev
                </button>

                <span className="fw-semibold">
                  Page {currentPage} of {totalPages}
                </span>

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
        </>
      )}
    </div>
  );
};

export default Statistics;
