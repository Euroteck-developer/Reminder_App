import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'react-toastify/dist/ReactToastify.css';

import Login from "./Frontend/Pages/Login";
import ForgotPassword from "./Frontend/Pages/ForgotPassword";
import ProtectedRoute from "./Frontend/Middleware/ProtectedRoute";
import SuperAdminDashboard from "./Frontend/SuperAdmin/SuperAdminDashboard";
import DirectorDashboard from "./Frontend/Director/DirectorDashoard";
import ManagingDirectorDashboard from "./Frontend/ManagingDirector/MdDashboard";
import ManagerDashboard from "./Frontend/Manager/ManagerDashboard";
import EmployeeDashboard from "./Frontend/Employee/EmployeeDashboard";

function App() {
    return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Protected Dashboards */}
        <Route
          path="/superadmin-dashboard/*"
          element={
            <ProtectedRoute allowedRoles={[1]}>
              <SuperAdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/director-dashboard/*"
          element={
            <ProtectedRoute allowedRoles={[2]}>
              <DirectorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/managing-director-dashboard/*"
          element={
            <ProtectedRoute allowedRoles={[3]}>
              <ManagingDirectorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/manager-dashboard/*"
          element={
            <ProtectedRoute allowedRoles={[4]}>
              <ManagerDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user-dashboard/*"
          element={
            <ProtectedRoute allowedRoles={[5]}>
              <EmployeeDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/unauthorized"
          element={
            <p
              style={{
                fontSize: "24px",
                fontWeight: "500",
                color: "#dc3545",
                textAlign: "center",
              }}
            >
              You are not an authorized person to view this page
            </p>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
