import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Footer from "./Footer";
import API_URL from "../../Api/Config";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    if (!rememberMe) {
      toast.warning("Please check 'Remember Me' before logging in!", { autoClose: 2000 });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store token
        localStorage.setItem("token", data.token);

        // Get role_id from backend
        const roleId = data.user.role_id;
        localStorage.setItem("role_id", roleId);
        localStorage.setItem("level", data.user.level);
        localStorage.setItem("user_id", data.user.id);

        // Map role_id to readable role_name
        let roleName = "";
        if (roleId === 1) roleName = "superadmin";
        else if (roleId === 2) roleName = "director";
        else if (roleId === 3) roleName = "managing_director";
        else if (roleId === 4) roleName = "manager";
        else if (roleId === 5) roleName = "user";
        else roleName = "unknown";

        localStorage.setItem("role_name", roleName);

        toast.success("Login successful!", { autoClose: 1500 });

        // Navigate based on role
        if (roleName === "superadmin") navigate("/superadmin-dashboard/dashboard");
        else if (roleName === "director") navigate("/director-dashboard/dashboard");
        else if (roleName === "managing_director") navigate("/managing-director-dashboard/dashboard");
        else if (roleName === "manager") navigate("/manager-dashboard/dashboard");
        else if (roleName === "user") navigate("/user-dashboard/dashboard");
        else navigate("/unauthorized");

      } else {
        toast.error(data.message || "Invalid credentials", { autoClose: 2000 });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Something went wrong. Try again.", { autoClose: 2000 });
    }
  };

  return (
    <>
      <div className="vh-100 d-flex justify-content-center align-items-center bg-light px-2">
        <div className="card shadow p-4" style={{ width: "100%", maxWidth: "400px", borderRadius: "15px" }}>
          <h2 className="text-center text-primary mb-4">Reminder App</h2>
          <form onSubmit={handleLogin}>
            {/* Email */}
            <div className="mb-3">
              <label htmlFor="email" className="form-label fw-semibold">Email</label>
              <input
                type="email"
                className="form-control"
                id="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            {/* Password */}
            <div className="mb-3">
              <label htmlFor="password" className="form-label fw-semibold">Password</label>
              <input
                type="password"
                className="form-control"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="off"
              />
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div className="form-check d-flex align-items-center">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={() => setRememberMe(!rememberMe)}
                />
                <label className="form-check-label ms-2" htmlFor="rememberMe" style={{ cursor: "pointer", userSelect: "none" }}>
                  Remember me
                </label>
              </div>
              <Link to="/forgot-password" className="text-primary fw-bold">Forgot Password?</Link>
            </div>

            <button type="submit" className="btn btn-primary w-100 py-2" style={{ borderRadius: "10px", fontWeight: 600 }}>
              Login
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <Footer />

      {/* Toast Notifications */}
      <ToastContainer position="top-center" autoClose={2000} />
    </>
  );
};

export default Login;
