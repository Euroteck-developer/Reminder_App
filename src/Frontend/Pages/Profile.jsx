import React, { useEffect, useState, useRef } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import API_URL from "../../Api/Config";

const Profile = () => {
  const [user, setUser] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({});
  const [departments, setDepartments] = useState([]);
  const [roles, setRoles] = useState([]);
  const [preview, setPreview] = useState(null);
  const token = localStorage.getItem("token");
  const fileInputRef = useRef(null);

  // Roles who can allow to edit Professional information
  const canEditProfessional =
    user?.role === "superadmin" ||
    user?.role === "managing_director" ||
    user?.role === "director";

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        const [profileRes, deptRes, roleRes] = await Promise.all([
          axios.get(`${process.env.REACT_APP_API_URL}/api/users/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${process.env.REACT_APP_API_URL}/api/users/departments`),
          axios.get(`${process.env.REACT_APP_API_URL}/api/users/roles`),
        ]);

        const profileData = profileRes.data;
        const dobOnly = profileData.dob ? profileData.dob.split("T")[0] : "";
        setUser(profileData);
        setFormData({ ...profileData, dob: dobOnly, remove_profile_pic: false });
        setDepartments(deptRes.data);
        setRoles(roleRes.data);
      } catch (err) {
        console.error("Error fetching profile:", err);
        toast.error("Failed to load profile data.");
      }
    };
    fetchAllData();
  }, [token]);

  if (!user) return <p className="text-center mt-5">Loading profile...</p>;

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData({
        ...formData,
        profile_file: file,
        remove_profile_pic: false,
      });
      setPreview(URL.createObjectURL(file));
    }
  };

  // Remove Image
  const handleRemoveImage = () => {
    if (fileInputRef.current) fileInputRef.current.value = "";

    // If preview is a new uploaded image, just clear it
    if (preview && !user.profile_pic) {
      setPreview(null);
    }

    // Set remove flag, but DO NOT delete backend image yet
    setFormData(prev => ({
      ...prev,
      profile_file: null,
      remove_profile_pic: true,
    }));

    // Only hide image in UI temporarily
    setPreview(null);

    toast.info("Image removed. Save to apply changes.");
  };

  const handleCancel = () => {
    setEditMode(false);
    const dobOnly = user.dob ? user.dob.split("T")[0] : "";
    setFormData({ ...user, dob: dobOnly, remove_profile_pic: false });
    setPreview(null);
  };

  const handleSave = () => {
    const requiredFields = [
      "name",
      "email",
      "dob",
      "mobile",
      "gender",
      "country",
      "state",
      "place",
      "role_id",
    ];

    if (formData.role_id) {
      const roleName = roles.find((r) => r.id === formData.role_id)?.name;
      if (roleName !== "managing_director" && roleName !== "director") {
        requiredFields.push("dept_id");
      }
    }

    for (let field of requiredFields) {
      if (!formData[field] || formData[field].toString().trim() === "") {
        toast.error(`Please fill ${field}`);
        return;
      }
    }

    const data = new FormData();
    const allowedFields = [
      "name",
      "email",
      "dob",
      "mobile",
      "gender",
      "country",
      "state",
      "place",
      "dept_id",
      "role_id",
      "profile_file",
      "remove_profile_pic",
      "level",
    ];

    allowedFields.forEach((key) => {
      if (formData[key] !== null && formData[key] !== undefined)
        data.append(key, formData[key]);
    });

    axios
      .put(`${process.env.REACT_APP_API_URL}/api/users/profile`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      })
      .then((res) => {
        setUser(res.data);
        setEditMode(false);
        setPreview(null);
        toast.success("Profile updated successfully!");
      })
      .catch((err) => {
        if (err.response) {
          toast.error(err.response?.data?.message);
        } else {
          toast.error("Error Udating Profile");
        }
        // console.error("Error updating profile:", err);
        // toast.error("Error updating profile");
      });
  };

  const avatar = preview
    ? preview
    : user.profile_pic
    ? `${process.env.REACT_APP_API_URL}${user.profile_pic}`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(
        user.name || "user"
      )}&background=0d6efd&color=fff&size=150`;

  return (
    <div className="container mt-4 profile-container">
      <ToastContainer position="top-center" />
      <div className="card shadow-lg border-0 p-3">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center flex-wrap">
          <h3 className="mb-0">My Profile</h3>
          {!editMode && (
            <button
              className="btn btn-light btn-sm mt-2 mt-sm-0"
              onClick={() => setEditMode(true)}
            >
              Edit
            </button>
          )}
        </div>

        <div className="card-body">
          <div className="row align-items-center text-center text-md-start">
            <div className="col-12 col-md-4 mb-4 d-flex flex-column align-items-center">
              <img
                src={avatar}
                alt="Profile"
                className="rounded-circle border border-3 border-primary shadow-sm"
                style={{ width: "150px", height: "150px", objectFit: "contain" }}
              />

              {editMode && (
                <div className="mt-3 w-100 px-2">
                  <input
                    type="file"
                    accept="image/*"
                    className="form-control"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                  {(preview || user.profile_pic) && (
                    <button
                      className="btn btn-danger btn-sm mt-2 w-100"
                      onClick={handleRemoveImage}
                    >
                      Remove Image
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="col-12 col-md-8">
              <h5 className="text-secondary mb-3">Personal Information</h5>
              <div className="row g-3">
                {[
                  { label: "Name", name: "name" },
                  { label: "Email", name: "email" },
                  { label: "Mobile", name: "mobile" },
                  {
                    label: "Gender",
                    name: "gender",
                    type: "select",
                    options: ["Male", "Female", "Other"],
                  },
                  { label: "DOB", name: "dob", type: "date" },
                  { label: "Country", name: "country" },
                  { label: "State", name: "state" },
                  { label: "Place", name: "place" },
                ].map((field) => (
                  <div className="col-12 col-sm-6" key={field.name}>
                    <label className="form-label fw-semibold">
                      {field.label}
                    </label>
                    {editMode ? (
                      field.type === "select" ? (
                        <select
                          className="form-select"
                          name={field.name}
                          value={formData[field.name] || ""}
                          onChange={handleChange}
                        >
                          <option value="">Select {field.label}</option>
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type || "text"}
                          className="form-control"
                          name={field.name}
                          value={formData[field.name] || ""}
                          onChange={handleChange}
                        />
                      )
                    ) : (
                      <p className="form-control-plaintext">
                        {field.type === "date" && user[field.name]
                          ? user[field.name].split("T")[0]
                          : user[field.name] || "-"}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* PROFESSIONAL INFORMATION */}
              <h5 className="text-secondary mb-3 mt-4">
                Professional Information
              </h5>
              <div className="row g-3">

                {/* Department */}
                {user.role !== "managing_director" &&
                  user.role !== "director" && (
                    <div className="col-12 col-sm-6">
                      <label className="form-label fw-semibold">
                        Department
                      </label>
                      {editMode && canEditProfessional ? (
                        <select
                          className="form-select"
                          name="dept_id"
                          value={formData.dept_id || ""}
                          onChange={handleChange}
                        >
                          <option value="">Select Department</option>
                          {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <p className="form-control-plaintext">
                          <span className="badge bg-primary">
                            {user.department}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                {/* Managing Level for Manager */}
                {["manager"].includes(user.role) && (
                  <div className="col-12 col-sm-6">
                    <label className="form-label fw-semibold">
                      Managing Level
                    </label>

                    {editMode && canEditProfessional ? (
                      <select
                        className="form-select"
                        name="level"
                        value={formData.level || ""}
                        onChange={handleChange}
                      >
                        <option value="">Select Level</option>
                        <option value="1">Level 1</option>
                        <option value="2">Level 2</option>
                        <option value="3">Level 3</option>
                        <option value="4">Level 4</option>
                        <option value="5">Level 5</option>
                      </select>
                    ) : (
                      <p className="form-control-plaintext">
                        <span className="badge bg-info">Level {user.level}</span>
                      </p>
                    )}
                  </div>
                )}

                {/* Role */}
                <div className="col-12 col-sm-6">
                  <label className="form-label fw-semibold">Role</label>

                  {editMode && canEditProfessional ? (
                    <select
                      className="form-select"
                      name="role_id"
                      value={formData.role_id || ""}
                      onChange={handleChange}
                    >
                      <option value="">Select Role</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="form-control-plaintext">
                      <span className="badge bg-success">{user.role}</span>
                    </p>
                  )}
                </div>
              </div>

              {editMode && (
                <div className="mt-4 d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-success flex-fill"
                    onClick={handleSave}
                  >
                    Save
                  </button>
                  <button
                    className="btn btn-secondary flex-fill"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
