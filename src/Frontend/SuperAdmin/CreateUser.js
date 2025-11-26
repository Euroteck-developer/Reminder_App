import React, { useState, useEffect } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import API_URL from "../../Api/Config";

const CreateUser = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    dob: "",
    gender: "",
    mobile: "",
    password: "",
    dept_id: "",
    role_id: "",
    level: "",
    reports_to: "",
    country: "",
    state: "",
    place: "",
    avatar: null,
  });

  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch departments and roles on mount
  useEffect(() => {
    axios
      .get(`${process.env.REACT_APP_API_URL}/api/users/departments`)
      .then((res) => setDepartments(res.data))
      .catch(() => toast.error("Failed to fetch departments"));

    axios
      .get(`${process.env.REACT_APP_API_URL}/api/users/roles`)
      .then((res) => setRoles(res.data))
      .catch(() => toast.error("Failed to fetch roles"));
  }, []);

  // Fetch Reports To based on selected role
  useEffect(() => {
    if (!formData.role_id) return;

    const params = { role_id: formData.role_id };

    // If the selected role is Manager, include level
    if (Number(formData.role_id) === 4 && formData.level) {
      params.level = formData.level;
    }

    axios
    .get(`${process.env.REACT_APP_API_URL}/api/users/reports-to`, { params })
    .then((res) => setUsers(res.data))
    .catch(() => {
      setUsers([]);
      toast.error("Failed to fetch reporting managers");
    });
  }, [formData.role_id, formData.level]);
  
  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === "avatar") {
      setFormData((prev) => ({ ...prev, avatar: files[0] }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const allowOnlyLetters = (value) => value.replace(/[^a-zA-Z\s]/g, "");
  const allowOnlyDigits = (value) => value.replace(/\D/g, "");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== null) data.append(key, formData[key]);
      });

      const res = await axios.post(`${process.env.REACT_APP_API_URL}/api/users/create`, data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.data.success) {
        toast.success(res.data.message || "User created successfully!");
        setFormData({
          name: "",
          email: "",
          dob: "",
          gender: "",
          mobile: "",
          password: "",
          dept_id: "",
          role_id: "",
          reports_to: "",
          country: "",
          state: "",
          place: "",
          avatar: null,
        });
        setUsers([]);
      } else {
        toast.error(res.data.message || "Failed to create user");
      }
    } catch (err) {
      console.error("Create User API Error:", err.response || err);
      if (err.response?.data?.message) {
        toast.error(err.response.data.message);
      } else if (err.message) {
        toast.error(err.message);
      } else {
        toast.error("Server error. Try again later.");
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedRole = roles.find((r) => r.id === Number(formData.role_id));
  const isManager = selectedRole?.name?.toLowerCase() === "manager";
  const hideDeptAndReportsTo =
    selectedRole &&
    ["managing_director", "director"].includes(selectedRole.name.toLowerCase().trim());

  return (
    <>
      <div className="d-flex justify-content-center align-items-center">
        <div className="card shadow-lg p-4" style={{ maxWidth: "600px", width: "100%" }}>
          <h4 className="text-center mb-3 text-primary">Create User</h4>

          {/* Avatar Preview */}
          <div className="d-flex justify-content-center mb-3">
            <img
              src={
                formData.avatar
                  ? URL.createObjectURL(formData.avatar)
                  : "https://cdn-icons-png.flaticon.com/512/3135/3135715.png"
              }
              alt="Avatar"
              className="rounded-circle border"
              style={{ width: "100px", height: "100px", objectFit: "contain" }}
            />
          </div>

          <form onSubmit={handleSubmit}>
            {/* Avatar */}
            <div className="mb-3">
              <label className="form-label">Upload Avatar</label>
              <input
                type="file"
                className="form-control"
                name="avatar"
                accept="image/*"
                onChange={handleChange}
                autoComplete="off"
              />
            </div>

            {/* Basic Info */}
            <div className="mb-3">
              <label className="form-label">Name</label>
              <input
                type="text"
                className="form-control"
                name="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: allowOnlyLetters(e.target.value) }))
                }
                required
                autoComplete="off"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-control"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="off"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Mobile</label>
              <input
                type="tel"
                className="form-control"
                name="mobile"
                value={formData.mobile}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, mobile: allowOnlyDigits(e.target.value) }))
                }
                required
                autoComplete="off"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Date of Birth</label>
              <input
                type="date"
                className="form-control"
                name="dob"
                value={formData.dob}
                onChange={handleChange}
                autoComplete="off"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Gender</label>
              <select
                className="form-select"
                name="gender"
                value={formData.gender}
                onChange={handleChange}
                required
              >
                <option value="">Select Gender</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>

            {/* Password */}
            <div className="mb-3">
              <label className="form-label">Password</label>
              <input
                type="password"
                className="form-control"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete="off"
              />
            </div>

            {/* Department - hide for MD/Director */}
            {!hideDeptAndReportsTo && (
              <div className="mb-3">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  name="dept_id"
                  value={formData.dept_id}
                  onChange={handleChange}
                  required
                  autoComplete="off"
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Role */}
            <div className="mb-3">
              <label className="form-label">Role</label>
              <select
                className="form-select"
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
                required
              >
                <option value="">Select Role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>

            {isManager && (
              <div className="mb-3">
                <label className="form-label">Manager Level</label>
                <select
                  className="form-select"
                  name="level"
                  value={formData.level}
                  onChange={handleChange}
                  required>
                    <option value="">Select Level</option>
                    <option value="1">L1</option>  
                    <option value="2">L2</option>                    
                    <option value="3">L3</option>                    
                    <option value="4">L4</option>                    
                    <option value="5">L5</option>                    
                  </select>
              </div>
            )}

            {/* Reports To - hide for MD/Director */}
            {!hideDeptAndReportsTo && (
              <div className="mb-3">
                <label className="form-label">Reports To</label>
                <select
                  className="form-select"
                  name="reports_to"
                  value={formData.reports_to}
                  onChange={handleChange}
                >
                  <option value="">Select Manager</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Location */}
            <div className="mb-3">
              <label className="form-label">Country</label>
              <input
                type="text"
                className="form-control"
                name="country"
                value={formData.country}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, country: allowOnlyLetters(e.target.value) }))
                }
                required
                autoComplete="off"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">State</label>
              <input
                type="text"
                className="form-control"
                name="state"
                value={formData.state}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, state: allowOnlyLetters(e.target.value) }))
                }
                required
                autoComplete="off"
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Place</label>
              <input
                type="text"
                className="form-control"
                name="place"
                value={formData.place}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, place: allowOnlyLetters(e.target.value) }))
                }
                required
                autoComplete="off"
              />
            </div>

            <button type="submit" className="btn btn-success w-100" disabled={loading}>
              {loading ? "Creating..." : "Create User"}
            </button>
          </form>
        </div>
      </div>

      <ToastContainer position="top-center" autoClose={2500} />
    </>
  );
};

export default CreateUser;
