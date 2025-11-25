import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import Select from "react-select";
import {
  Spinner,
  Badge,
  Button,
  Card,
  Form,
  Row,
  Col,
  Modal,
} from "react-bootstrap";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import API_URL from "../../Api/Config";
import { Trash } from "lucide-react";
import SelfReminder from "./SelfRemider";

const TaskEdit = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [prevAssignedUsers, setPrevAssignedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role_name")?.toLowerCase();

  const currentLevel = Number(localStorage.getItem("level")); // Current user level
  const currentId = Number(localStorage.getItem("id")); // For self-assign

  const isManagerOrAbove = [
    "manager",
    "director",
    "managing_director",
    "superadmin",
  ].includes(role);
  const isUser = role === "user";

  useEffect(() => {
  if (!token) {
    navigate("/");
    return;
  }

  const fetchData = async () => {
    try {
      const [taskRes, usersRes] = await Promise.all([
        axios.get(`${API_URL}/api/reminders/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_URL}/api/users/all-users`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      const taskData = taskRes.data;
      let usersList = usersRes.data;

      if (role === "superadmin") {
        // Superadmin → cannot assign MD (role_id=2) or Director (role_id=3)
        usersList = usersList.filter(
          (u) => ![2, 3].includes(Number(u.role_id))
        );
      } else if (role === "manager") {
        usersList = usersList.filter((u) => {
          const lvl = Number(u.level);
          const isNormalUser = Number(u.role_id) === 5;

          if (isNormalUser) return true;

          if (currentLevel === 1) return lvl >= 1 && lvl <= 5;
          if (currentLevel === 2) return lvl >= 2 && lvl <= 5;
          if (currentLevel === 3) return lvl >= 3 && lvl <= 5;
          if (currentLevel === 4) return lvl >= 4 && lvl <= 5;
          if (currentLevel === 5) return lvl >= 5;
          return false;
        });
      } else if (isUser) {
        usersList = usersList.filter((u) => u.id === currentId);
      }

      const usersData = usersList.map((u) => ({
        value: u.id,
        label: `${u.name} <${u.email}>`,
      }));

      const currentAssigned =
        taskData.assigned_users?.map((u) => ({
          value: u.user_id,
          label: `${u.user_name} <${u.user_email}>`,
        })) || [];

      const previousAssignedNames =
        taskData.previously_assigned?.map(
          (u) => `${u.user_name} <${u.user_email}>`
        ) || [];

      setTask({
        ...taskData,
        assignedUsers: currentAssigned,
      });

      setAllUsers(usersData);
      setPrevAssignedUsers(previousAssignedNames);
    } catch (err) {
      console.error(err);
      setError("Failed to load task details");
    } finally {
      setLoading(false);
    }
  };

  fetchData();

// eslint-disable-next-line react-hooks/exhaustive-deps
}, [id]);


  const handleChange = (field, value) => {
    setTask((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssignedUsersChange = (selectedOptions) => {
    setTask((prev) => ({
      ...prev,
      assignedUsers: selectedOptions || [],
    }));
  };

  const toUTCString = (localDateTime) => {
    if (!localDateTime) return null;
    const local = new Date(localDateTime);
    return new Date(local.getTime() - local.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 19)
      .replace("T", " ");
  };

  const handleSave = async () => {
    if (!task) return;

    if (!task.assignedUsers || task.assignedUsers.length === 0) {
      toast.info("Atleast one user should be selected");
      return;
    }

    setSaving(true);

    try {
      const assignedIds = task.assignedUsers.map((u) => u.value);

      const payload = {
        taskId: id,
        status: task.status,
        statusDesc: isUser ? task.status_desc : null,
        extendedDue: task.extended_due_date
          ? toUTCString(task.extended_due_date)
          : null,
        assignedTo: assignedIds,
      };

      await axios.put(`${API_URL}/api/reminders/update-task-status`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Task updated successfully!");
      setTimeout(() => navigate(-1), 1000);
    } catch (err) {
      console.error(err);
      toast.error("Failed to update task");
    } finally {
      setSaving(false);
    }
  };

  const toLocalInputValue = (utcString) => {
    if (!utcString) return "";
    const date = new Date(utcString);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await axios.delete(`${API_URL}/api/reminders/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.success) {
        toast.success(res.data.message || "Task deleted successfully");
        setShowDeleteModal(false);
        setTimeout(() => {
          if (role === "superadmin") navigate("/superadmin-dashboard/dashboard");
          else if (role === "director") navigate("/director-dashboard/dashboard");
          else if (role === "managing_director")
            navigate("/managing-director-dashboard/dashboard");
          else if (role === "manager") navigate("/manager-dashboard/dashboard");
          else if (role === "user") navigate("/user-dashboard/dashboard");
          else navigate("/unauthorized");
        }, 1200);
      } else {
        toast.warning(res.data.message || "Something went wrong");
      }
    } catch (err) {
      const message =
        err.response?.data?.message ||
        "Server error while deleting task. Please try again.";
      toast.error(message);
    } finally {
      setDeleting(false);
    }
  };

  const loggedInEmail = localStorage.getItem("email")?.toLowerCase();
  const canDelete = loggedInEmail === task?.created_by_email?.toLowerCase();

  if (loading)
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" variant="primary" />
        <p className="mt-2">Loading task details...</p>
      </div>
    );

  if (error)
    return (
      <div className="text-center mt-5 text-danger">
        <h5>{error}</h5>
      </div>
    );

  if (!task)
    return (
      <div className="text-center mt-5 text-muted">
        <h5>No task found</h5>
      </div>
    );

  return (
    <div className="container mt-4">
      <Button variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
        ← Back
      </Button>

      <Card className="mt-4 shadow-sm p-4">
        <Row>
          <Col className="text-end">
            <Badge
              bg={
                task.priority === "High"
                  ? "danger"
                  : task.priority === "Medium"
                  ? "warning"
                  : "success"
              }
              className="p-2"
            >
              {task.priority}
            </Badge>
          </Col>
        </Row>

        <Row>
          <Col>
            <h5>Task Description:</h5>
            <p
              className="mb-3"
              style={{ overflow: "hidden", whiteSpace: "break-spaces" }}
            >
              {task.description}
            </p>
          </Col>
        </Row>

        <hr />

        <div className="mb-3">
          <strong>Assigned Date:</strong>{" "}
          {new Date(task.assigned_date).toLocaleString()}
        </div>
        <div className="mb-3">
          <strong>Due Date:</strong>{" "}
          {new Date(task.due_date).toLocaleString()}
        </div>

        <div className="mb-3">
          <Form.Label>
            <strong>Extended Due Date:</strong>
          </Form.Label>
          {isManagerOrAbove ? (
            <Form.Control
              type="datetime-local"
              value={toLocalInputValue(task.extended_due_date)}
              onChange={(e) => handleChange("extended_due_date", e.target.value)}
            />
          ) : (
            <div>
              {task.extended_due_date
                ? new Date(task.extended_due_date).toLocaleString()
                : "-"}
            </div>
          )}
        </div>

        <div className="mb-3">
          <SelfReminder taskId={task.id} taskStatus={task.status} />
        </div>

        <div className="mb-3">
          <Form.Label>
            <strong>Status:</strong>
          </Form.Label>
          {isManagerOrAbove ? (
            <Form.Select
              value={task.status || "Pending"}
              onChange={(e) => handleChange("status", e.target.value)}
            >
              <option value="Pending">Pending</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </Form.Select>
          ) : (
            <div>{task.status || "-"}</div>
          )}
        </div>

        {isUser && (
          <div className="mb-3">
            <Form.Label>
              <strong>Status Description:</strong>
            </Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={task.status_desc || ""}
              onChange={(e) => handleChange("status_desc", e.target.value)}
              placeholder="Update task progress..."
            />
          </div>
        )}

        <div className="mb-3">
          <Form.Label>
            <strong>Assigned To (Current):</strong>
          </Form.Label>
          {isManagerOrAbove ? (
            <Select
              isMulti
              options={allUsers}
              value={task.assignedUsers}
              onChange={handleAssignedUsersChange}
              placeholder="Select users..."
              required
            />
          ) : (
            <div>
              {task.assignedUsers?.length
                ? task.assignedUsers.map((u) => u.label).join(", ")
                : "-"}
            </div>
          )}

          <div className="mt-3">
            <strong>Previously Assigned:</strong>
            <div className="d-flex flex-wrap gap-2 mt-1">
              {prevAssignedUsers.length > 0 ? (
                prevAssignedUsers.map((u, i) => (
                  <Badge key={i} bg="secondary" className="p-2">
                    {u}
                  </Badge>
                ))
              ) : (
                <span className="text-muted">—</span>
              )}
            </div>
          </div>
        </div>

        <div className="mb-3">
          <strong>Created By:</strong> {task.created_by_name}
        </div>

        {(isManagerOrAbove || isUser) && (
          <>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving}
              className="mt-3 me-3"
            >
              {saving ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>

            {canDelete && (
              <Button
                variant="danger"
                className="mt-3"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash size={16} className="me-2" />
                Delete Task
              </Button>
            )}
          </>
        )}
      </Card>

      <Modal
        show={showDeleteModal}
        onHide={() => setShowDeleteModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Confirm Deletion</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this task?
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </Modal.Footer>
      </Modal>

      <ToastContainer position="top-center" autoClose={2000} />
    </div>
  );
};

export default TaskEdit;
