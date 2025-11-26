import React, { useEffect, useState } from "react";
import axios from "axios";
import { FaFileExcel, FaFilePdf, FaEdit, FaTrash } from "react-icons/fa";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Modal, Button } from "react-bootstrap";
import { FaSortAlphaDown, FaSortAlphaUp } from "react-icons/fa";
import * as XLSX from "xlsx";
import saveAs  from "file-saver";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import API_URL from "../../Api/Config";


const UsersList = () => {
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showModal, setShowModal] = useState(false);
  const [modalData, setModalData] = useState({});
  const [showDeleteModel, setShowDeleteModel] = useState(false);
  const [deleteUserData, setDeleteUserData] = useState({ id: null, name: ""});
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [usersForReportsTo, setUsersForReportsTo] = useState([]);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
    fetchDepartments();
  }, []);

  // Fetching users 
  const fetchUsers = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      console.warn("Missing token — please log in again");
      toast.error("Session expired. Please log in again.");
      return;
    }

    // Decode the JWT to extract id and role_id
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const decoded = JSON.parse(atob(base64)); //atob Base64-encoded string back into normal text
    const currentUser = { id: decoded.id, role_id: decoded.role_id };
    
    axios.get(`${process.env.REACT_APP_API_URL}/api/users/all-users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => {
      const allUsers = res.data || [];
      let filtered = [];

      if ([1, 2, 3].includes(currentUser.role_id)) {
        // Superadmin, Director, Managing Director → all users
        filtered = allUsers;
      } else if (currentUser.role_id === 4) {
        // Manager only users reporting to them
        filtered = allUsers.filter(
          (user) => user.reports_to_id === currentUser.id
        );
      } else {
        // Normal user only self
        filtered = allUsers.filter((user) => user.id === currentUser.id);
      }

      setUsers(filtered);
      setFilteredUsers(filtered);
      setUsersForReportsTo(allUsers);
      setLoading(false);
    })
    .catch((err) => {
      console.error("Failed to fetch users:", err);
      toast.error("Failed to fetch users");
    });
  };

  // Fetch Roles
  const fetchRoles = () => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/users/roles`)
      .then((res) => setRoles(res.data))
      .catch(() => toast.error("Failed to fetch roles"));
  };

  // Fetch departments
  const fetchDepartments = () => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/users/departments`)
      .then((res) => setDepartments(res.data))
      .catch(() => toast.error("Failed to fetch departments"));
  };

  // Search filter
  useEffect(() => {
    const filtered = users.filter((user) =>
      Object.values(user).some((val) =>
        val ? val.toString().toLowerCase().includes(searchTerm.toLowerCase()) : false
      )
    );
    setFilteredUsers(filtered);
    setCurrentPage(1);
  }, [searchTerm, users]);

  // Sorting
  const handleSort = (key) => {
    let direction = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending")
      direction = "descending";
    setSortConfig({ key, direction });

    const sorted = [...filteredUsers].sort((a, b) => {
      const valA = a[key] ? a[key].toString().toLowerCase() : "";
      const valB = b[key] ? b[key].toString().toLowerCase() : "";
      if (valA < valB) return direction === "ascending" ? -1 : 1;
      if (valA > valB) return direction === "ascending" ? 1 : -1;
      return 0;
    });
    setFilteredUsers(sorted);
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key !== key) return null;
    return sortConfig.direction === "ascending" ? (
      <FaSortAlphaDown />
    ) : (
      <FaSortAlphaUp />
    );
  };

  // Pagination
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const cleanedUsers = filteredUsers.filter(
    u => u.role !== "managing_director" && u.role !== "director"
  );

  const currentUsers = cleanedUsers.slice(indexOfFirstItem, indexOfLastItem);

  // Modal Edit
  const handleEditClick = (user) => {
    setModalData({
      ...user,
      dob: user.dob ? user.dob.split("T")[0] : "",
      level: user.level || ""
    });
    setShowModal(true);
  };

  const handleModalChange = (e, field) => {
    const updatedValue = e.target.value;
    const updatedData = { ...modalData, [field]: updatedValue };
    if (field === "role") updatedData.reports_to = "";
    setModalData(updatedData);
  };
  
  const handleSaveModal = () => {
    const selectedDept = departments.find((d) => d.name === modalData.department);
    const selectedRole = roles.find((r) => r.name === modalData.role);
    const selectedManager = usersForReportsTo.find((u) => u.name === modalData.reports_to);

    // Validation for Manager Level
    if (modalData.role === "manager" && (!modalData.level || modalData.level === "")) {
      toast.error("Manager level is required for Manager role!");
    }
    
    const updatedUser = {
      name: modalData.name,
      email: modalData.email,
      mobile: modalData.mobile,
      dob: modalData.dob,
      gender: modalData.gender,
      dept_id: selectedDept ? selectedDept.id : null,
      role_id: selectedRole ? selectedRole.id : null,
      reports_to: selectedManager ? selectedManager.id : null,
      country: modalData.country,
      state: modalData.state,
      place: modalData.place,
      level: modalData.level || null
    };
    axios
    .put(`${process.env.REACT_APP_API_URL}/api/users/update/${modalData.id}`, updatedUser)
    .then((res) => {
      if (res.data.success) {
        toast.success(res.data.message); 
        setShowModal(false);
        fetchUsers();
      } else {
        toast.error(res.data.message);
      }
    })
    .catch((err) => {
      // Handle backend validation error
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Failed to update user!");
      }
    });
  };

  // open modal for delete
  const handleDeleteClick = (user) => {
    setDeleteUserData({ id: user.id, name: user.name });
    setShowDeleteModel(true);
  };
  
  // Confirm Delete
  const confirmDelete = () => {
    axios
    .delete(`${process.env.REACT_APP_API_URL}/api/users/delete/${deleteUserData.id}`)
    .then(() => {
      toast.success(`${deleteUserData.name} deleted successfully!`);
      fetchUsers();
      setShowDeleteModel(false);
    })
    .catch((err) => {
      // Check backend response for specific message
      if (err.response && err.response.data && err.response.data.message) {
        toast.error(err.response.data.message);
      } else {
        toast.error("Failed to delete user!"); // Fallback message
      }
      setShowDeleteModel(false);
    });
  };

  const getReportsToOptions = () => {
    if (!modalData.role) return [];

    // Convert role names to easier variables
    const role = modalData.role;
    const level = parseInt(modalData.level || 0);

    //  Normal user can report to any manager (any level)
    if (role === "user") {
      return usersForReportsTo.filter(u => u.role === "manager");
    }

    //  Manager-level hierarchy
    if (role === "manager") {
      if (!level) return [];

      // L1 can report to MD or Director
      if (level === 1) {
        return usersForReportsTo.filter(
          (u) => u.role === "managing_director" || u.role === "director"
        );
      }

      // L2 can report only to L1 managers
      if (level === 2) {
        return usersForReportsTo.filter(
          (u) => u.role === "manager" && parseInt(u.level) === 1
        );
      }

      // L3 report to L2
      if (level === 3) {
        return usersForReportsTo.filter(
          (u) => u.role === "manager" && parseInt(u.level) === 2
        );
      }

      // L4 report to L3
      if (level === 4) {
        return usersForReportsTo.filter(
          (u) => u.role === "manager" && parseInt(u.level) === 3
        );
      }

      // L5 report to L4
      if (level === 5) {
        return usersForReportsTo.filter(
          (u) => u.role === "manager" && parseInt(u.level) === 4
        );
      }
    }

    //  Director can report to MD
    if (role === "director") {
      return usersForReportsTo.filter((u) => u.role === "managing_director");
    }

    return [];
  };
  
  // Excel download
  const exportToExcel = () => {
    if (!filteredUsers.length) {
      toast.info("No users to export");
      return;
    }
    
    // Map users for Excel
    const exportData = filteredUsers
    .filter(u => u.role !== "managing_director" && u.role !== "director")
    .map((user, index) => ({
      "S.No": index + 1,
      Name: user.name,
      Email: user.email,
      Mobile: user.mobile,
      Department: user.department,
      Role: user.role,
      "Reports To": user.reports_to || "",
      Country: user.country,
      State: user.state,
      Place: user.place,
    }));
    
    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);
    
    // Create workbook and append worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    
    // Write workbook and save
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const data = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(data, `RemainderApp_Users_List_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel downloaded!");
  };

  // Pdf download
  const exportToPDF = () => {
    if (!filteredUsers.length) {
      toast.info("No users to export");
      return;
    }

    const doc = new jsPDF("l", "pt", "a4");

    doc.setFontSize(18);
    doc.text("Users List", doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });

    const headers = [
      "S.No",
      "Name",
      "Email",
      "Mobile",
      "Department",
      "Role",
      "Reports To",
      "Country",
      "State",
      "Place",
    ];

    const data = filteredUsers
    .filter((u) => u.role !== "managing_director" && u.role !== "director")
    .map((user, index) => [
      index + 1,
      user.name || "-",
      user.email || "-",
      user.mobile || "-",
      user.department || "-",
      user.role || "-",
      user.reports_to || "-",
      user.country || "-",
      user.state || "-",
      user.place || "-",
    ]);
      
    autoTable(doc, {
      startY: 60,
      head: [headers],
      body: data,
      theme: "grid",
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: "bold",
        halign: "center",
      },
      bodyStyles: {
        fillColor: [245, 245, 245],
        textColor: 0,
        fontSize: 10,
        halign: "center",
        cellWidth: 'wrap', 
      },
      columnStyles: {
        1: { cellWidth: 'auto' },
        2: { cellWidth: 'auto' },
        3: { cellWidth: 'auto' },
        4: { cellWidth: 'auto' },
        5: { cellWidth: 'auto' },
        6: { cellWidth: 'auto' },
        7: { cellWidth: 'auto' },
        8: { cellWidth: 'auto' },
        9: { cellWidth: 'auto' },
      },
      alternateRowStyles: { fillColor: [255, 255, 255] },
      margin: { left: 20, right: 20 },
      tableWidth: "auto",
      styles: { overflow: 'linebreak', fontSize: 10 },
    });

    doc.save(`RemainderApp_Users_List_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  if (loading) return <p>Loading users...</p>;

  return (
    <div className="container mt-4">
      <ToastContainer position="top-center" autoClose={2000} />
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3>Users List</h3>
        <div>
          <button className="btn btn-success me-2" onClick={exportToExcel}>
            <FaFileExcel className="me-1" /> Excel
          </button>
          <button className="btn btn-danger" onClick={exportToPDF}>
            <FaFilePdf className="me-1" /> PDF
          </button>
        </div>
      </div>

      <input
        type="text"
        className="form-control mb-3"
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
      />

      <div className="table-responsive">
        <table className="table table-striped table-bordered table-hover align-middle text-center">
          <thead className="table-dark">
            <tr>
              <th>S.No</th>
              <th style={{ cursor: "pointer" }} onClick={() => handleSort("name")}>
                Name {getSortIndicator("name")}
              </th>
              <th>Email</th>
              <th>Mobile</th>
              <th>DOB</th>
              <th>Gender</th>
              <th>Department</th>
              <th style={{ cursor: "pointer" }} onClick={() => handleSort("role")}>
                Role {getSortIndicator("role")}
              </th>
              <th>Reports To</th>
              <th>Country</th>
              <th>State</th>
              <th>Place</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.filter(u => u.role !== "managing_director" && u.role !== "director").length > 0 ? (
              currentUsers
              .filter(u => u.role !== "managing_director" && u.role !== "director")
              .map((user, index) => (
              <tr key={user.id}>
                <td>{indexOfFirstItem + index + 1}</td>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>{user.mobile}</td>
                <td>{user.dob ? user.dob.split("T")[0] : "-"}</td>
                <td>{user.gender}</td>
                <td>{user.department}</td>
                <td>{user.role}</td>
                <td>{user.reports_to || "-"}</td>
                <td>{user.country}</td>
                <td>{user.state}</td>
                <td>{user.place}</td>
                <td>
                  <div className="d-flex flex-row">
                    <button
                      className="btn btn-outline-primary btn-sm me-2"
                      onClick={() => handleEditClick(user)}
                    >
                      <FaEdit />
                    </button>

                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDeleteClick(user)}
                    >
                      <FaTrash />
                    </button>
                  </div>
                </td>
              </tr>
              ))
            ) : (
            <tr>
              <td colSpan="13" className="text-center">
                No users found
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <nav>
          <ul className="pagination justify-content-center">
            {[...Array(totalPages)].map((_, i) => (
              <li key={i + 1} className={`page-item ${currentPage === i + 1 ? "active" : ""}`}>
                <button className="page-link" onClick={() => setCurrentPage(i + 1)}>
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Edit Modal */}
      {showModal && (
        <div className="modal show fade d-block" tabIndex="-1">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Edit User</h5>
                <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
              </div>
              <div className="modal-body">
                <div className="row">
                  {/* Name, Email, Mobile, DOB, Country, State, Place */}
                  {[
                    ["Name", "name"],
                    ["Email", "email"],
                    ["Mobile", "mobile"],
                    ["DOB", "dob", "date"],
                    ["Country", "country"],
                    ["State", "state"],
                    ["Place", "place"],
                  ].map(([label, key, type]) => (
                    <div className="col-md-6 mb-3" key={key}>
                      <label className="form-label">{label}</label>
                      <input
                        type={type || "text"}
                        className="form-control"
                        value={modalData[key] || ""}
                        onChange={(e) => handleModalChange(e, key)}
                      />
                    </div>
                  ))}

                  {/* Gender */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Gender</label>
                    <select
                      className="form-select"
                      value={modalData.gender || ""}
                      onChange={(e) => handleModalChange(e, "gender")}
                    >
                      <option value="">Select Gender</option>
                      <option>Male</option>
                      <option>Female</option>
                      <option>Other</option>
                    </select>
                  </div>

                  {/* Department */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Department</label>
                    <select
                      className="form-select"
                      value={modalData.department || ""}
                      onChange={(e) => handleModalChange(e, "department")}
                    >
                      <option value="">Select Department</option>
                      {departments.map((d) => (
                        <option key={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Role */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Role</label>
                    <select
                      className="form-select"
                      value={modalData.role || ""}
                      onChange={(e) => handleModalChange(e, "role")}
                    >
                      <option value="">Select Role</option>
                      {roles.map((r) => (
                        <option key={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Manager Level - only for role is manager */}
                  {modalData.role === "manager" && (
                    <div className="col-md-6 mb-3">
                      <label className="form-label">Manager Level</label>
                      <select
                        className="form-select"
                        value={modalData.level || ""}
                        onChange={(e) => handleModalChange(e, "level")}
                        required
                      >
                        <option value="">Select Level</option>
                        <option value="1">L1</option>
                        <option value="2">L2</option>
                        <option value="3">L3</option>
                        <option value="4">L4</option>
                        <option value="5">L5</option>
                      </select>
                    </div>
                  )}

                  {/* Reports To */}
                  <div className="col-md-6 mb-3">
                    <label className="form-label">Reports To</label>
                    <select
                      className="form-select"
                      value={modalData.reports_to || ""}
                      onChange={(e) => handleModalChange(e, "reports_to")}
                    >
                      <option value="">Select Manager</option>
                      {getReportsToOptions().map((u) => (
                        <option key={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button className="btn btn-success" onClick={handleSaveModal}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Modal
        show={showDeleteModel}
        onHide={() => setShowDeleteModel(false)}
        centered
      >
        <Modal.Header closeButton>
            <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
            Are you sure you want to delete <strong>{deleteUserData?.name}</strong>?
        </Modal.Body>
        <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteModel(false)}>
                Cancel
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
                Delete
            </Button>
        </Modal.Footer>
      </Modal>

      {showModal && <div className="modal-backdrop fade show"></div>}
    </div>
  );
};

export default UsersList;
