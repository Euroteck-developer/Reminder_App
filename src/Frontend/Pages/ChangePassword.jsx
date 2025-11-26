import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import API_URL from "../../Api/Config";

const ChangePassword = () => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isOldPasswordValid, setIsOldPasswordValid] = useState(false);
  const [loading, setLoading] = useState(false);

  // Navigate to login after successful password change
  const navigate = useNavigate();

  // Get email from JWT stored in localStorage
  const getEmailFromToken = () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return null;
      const payload = JSON.parse(atob(token.split(".")[1]));
      return payload.email; // your backend returns email in JWT
    } catch (err) {
      console.error("Invalid token:", err);
      return null;
    }
  };

  const email = getEmailFromToken();
  if (!email) toast.error("User not authenticated!");

  //  Verify Old Password
  const handleVerifyOldPassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/verify-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, oldPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Old password verified!");
        setIsOldPasswordValid(true);
      } else {
        toast.error(data.message || "Old password is incorrect!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  //  Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (newPassword !== confirmPassword) {
      toast.warning("New passwords do not match!");
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      toast.warning("Password should be at least 6 characters long!");
      setLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${process.env.REACT_APP_API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email, newPassword }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success("Password changed successfully!");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setIsOldPasswordValid(false);
        navigate("/");
      } else {
        toast.error(data.message || "Unable to change password.");
      }
    } catch (err) {
      console.error(err);
      toast.error("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className=" container d-flex justify-content-center mt-5">
        <div className="card shadow-sm p-4" style={{ maxWidth: "400px", width: "100%" }}>
          <h4 className="text-center mb-3 text-primary">Change Password</h4>

          {!isOldPasswordValid ? (
            <form onSubmit={handleVerifyOldPassword}>
              <div className="mb-3">
                <label className="form-label">Old Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter old password"
                  autoComplete="off"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100" disabled={loading}>
                {loading ? "Verifying..." : "Verify Password"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleChangePassword}>
              <div className="mb-3">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="off"
                  required
                />
              </div>
              <div className="mb-3">
                <label className="form-label">Re-enter New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="off"
                  required
                />
              </div>
              <button type="submit" className="btn btn-success w-100" disabled={loading}>
                {loading ? "Updating..." : "Update Password"}
              </button>
            </form>
          )}
        </div>
      </div>
      <ToastContainer position="top-center" autoClose={2000} />
    </>
  );
};

export default ChangePassword;
