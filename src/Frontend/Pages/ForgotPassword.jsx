import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import API_URL from "../../Api/Config";
import Footer from "../Pages/Footer";

const ForgotPassword = () => {
  const [step, setStep] = useState(1); // 1=send email, 2=verify OTP, 3=reset password
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(Array(6).fill(""));
  const [timer, setTimer] = useState(150); // 2:30 minutes
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const otpRefs = useRef([]);

  const navigate = useNavigate();

  useEffect(() => {
    let interval;
    if (step === 2 && timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer, step]);

  // Step 1: Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!email) return toast.error("Email is required");

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/password/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setTimer(150);
        setStep(2);
        toast.success(data.message);
        setOtp(Array(6).fill(""));
        otpRefs.current[0]?.focus();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    const otpValue = otp.join("");
    if (otpValue.length < 6) return toast.error("Enter complete OTP");

    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        setStep(3);
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || !confirmPassword) return toast.error("Fill all fields");
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");

    try {
      const otpValue = otp.join("");
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/password/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpValue, newPassword }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message);
        // Reset state
        setStep(1);
        setEmail("");
        setOtp(Array(6).fill(""));
        setNewPassword("");
        setConfirmPassword("");
        setTimer(150);
        // Navigate to login page
        navigate("/");
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    }
  };

  const handleOtpChange = (e, index) => {
    const value = e.target.value.replace(/\D/g, "");
    const newOtp = [...otp];
    newOtp[index] = value.charAt(0) || "";
    setOtp(newOtp);

    if (value && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      e.preventDefault();
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      if (index > 0) otpRefs.current[index - 1]?.focus();
    }
  };

  const handleResendOtp = async () => {
    try {
      const res = await fetch(`${process.env.REACT_APP_API_URL}/api/password/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("OTP resent successfully!");
        setTimer(150);
        setOtp(Array(6).fill(""));
        otpRefs.current[0]?.focus();
      } else {
        toast.error(data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong");
    }
  };

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 bg-light">
      <ToastContainer position="top-center" />
      <div className="card shadow p-4" style={{ width: "400px", borderRadius: "15px" }}>
        {step === 1 && (
          <>
            <h2 className="text-center text-primary mb-3">Forgot Password</h2>
            <form onSubmit={handleSendOtp}>
              <div className="mb-3">
                <label>Email</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="off"
                />
              </div>
              <button type="submit" className="btn btn-primary w-100">Send OTP</button>
            </form>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="text-center text-primary mb-3">Verify OTP</h2>
            <form onSubmit={handleVerifyOtp}>
              <div className="d-flex justify-content-between mb-3">
                {otp.map((d, i) => (
                  <input
                    key={i}
                    type="text"
                    maxLength="1"
                    className="form-control text-center"
                    autoComplete="off"
                    style={{ width: "50px" }}
                    value={otp[i]}
                    ref={(el) => (otpRefs.current[i] = el)}
                    onChange={(e) => handleOtpChange(e, i)}
                    onKeyDown={(e) => handleOtpKeyDown(e, i)}
                  />
                ))}
              </div>
              <div className="mb-2 text-center text-muted">
                Time remaining: {Math.floor(timer / 60)}:{("0" + (timer % 60)).slice(-2)}
              </div>
              <button type="submit" className="btn btn-primary w-100 mb-2">Verify OTP</button>
              {timer === 0 && (
                <button type="button" className="btn btn-outline-secondary w-100" onClick={handleResendOtp}>
                  Resend OTP
                </button>
              )}
            </form>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="text-center text-primary mb-3">Reset Password</h2>
            <form onSubmit={handleResetPassword}>
              <div className="mb-3">
                <label>New Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <div className="mb-3">
                <label>Confirm Password</label>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="off"
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary w-100">Reset Password</button>
            </form>
          </>
        )}

        <p className="mt-3 text-center text-muted">
          <Link to="/" className="text-primary fw-bold">Back to Login</Link>
        </p>
      </div>
      <Footer />
    </div>
  );
};

export default ForgotPassword;
