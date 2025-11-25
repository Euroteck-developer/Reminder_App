import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import API_URL from "../../Api/Config";
import { ToastContainer, toast } from "react-toastify";
import DatePicker from "react-datepicker";
import Select from "react-select";
import "react-toastify/dist/ReactToastify.css";
import "react-datepicker/dist/react-datepicker.css";

// Priority Badge Component
const PriorityBadge = ({ level }) => {
  let color;
  switch (level) {
    case "High": color = "#e74c3c"; break;   
    case "Medium": color = "#f39c12"; break; 
    case "Low": color = "#27ae60"; break;    
    default: color = "#7f8c8d";              
  }

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      fontWeight: "bold",
      color: "#000",
      marginRight: "6px"
    }}>
      <span style={{
        width: 0,
        height: 0,
        borderLeft: "6px solid transparent",
        borderRight: "6px solid transparent",
        borderBottom: `12px solid ${color}`,
        marginRight: "6px"
      }} />
      {level}
    </span>
  );
};

const Remainders = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState("task");

  // Users & Departments
  const [allUsers, setAllUsers] = useState([]);
  const [departments, setDepartments] = useState([]);

  // Task States
  const [taskDescription, setTaskDescription] = useState("");
  const [assignedUsers, setAssignedUsers] = useState([]);
  const [assignedDate, setAssignedDate] = useState(new Date());
  const [dueDate, setDueDate] = useState(null);
  const [taskPriority, setTaskPriority] = useState("Medium");

  // Meeting States
  const [meetingDescription, setMeetingDescription] = useState("");
  const [meetingDateTime, setMeetingDateTime] = useState(null);
  const [meetingDepts, setMeetingDepts] = useState([]);
  const [meetingUsers, setMeetingUsers] = useState([]);
  const [meetingPriority, setMeetingPriority] = useState("Medium");

  // Allowed roles
  const allowedRoleIds = [1,2,3,4,5];
  const canSendRemainder = allowedRoleIds.includes(Number(currentUser?.role_id));

  //Restricted for meetings
  const roleId = Number(currentUser?.role_id);
  const isSelfUser = roleId === 5;
  
  const token = localStorage.getItem("token");

  // Fetch Users
  const fetchUsers = useCallback(() => {
    axios
    .get(`${API_URL}/api/users/all-users`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    .then((res) => {
      const raw = res.data || [];

      const loggedFromRaw = raw.find(
        (u) => Number(u.id) === Number(currentUser?.id)
      );

      const currentLevel = Number(
        currentUser?.level ?? loggedFromRaw?.level ?? 0
      );
      const currentRole = Number(
        currentUser?.role_id ?? loggedFromRaw?.role_id ?? 0
      );

      const allowedUsers = raw.filter((u) => {
        const userLevel = Number(u.level ?? 0);
        const userRole = Number(u.role_id ?? 0);

        if (Number(u.id) === Number(currentUser?.id)) return true;

        if (currentRole === 5) return false;

        if (currentRole === 2 || currentRole === 3) return true;

        if (currentRole === 1) {
          if ([2, 3].includes(userRole)) return false;
          return true;
        }

        if (currentRole === 4) {
          if ([2, 3].includes(userRole)) return false;
          if (userRole === 5) return true;
          return userLevel > currentLevel;
        }

        return false;
      });

      const formatted = allowedUsers.map((u) => ({
        value: u.id,
        label: `${u.name} <${u.email}>`,
        level: u.level,
        role: u.role_id,
        department:
          u.dept_id ??
          u.department_id ??
          u.deptId ??
          u.department ??
          null,
      }));

      setAllUsers(formatted);
    })
    .catch((err) => {
      console.error("Failed to fetch users", err);
      toast.error("Failed to fetch users");
    });
  }, [token, currentUser]);


  // Fetch Departments
  const fetchDepartments = () => {
    axios.get(`${API_URL}/api/users/departments`)
      .then(res => setDepartments(res.data))
      .catch(() => toast.error("Failed to fetch departments"));
  };

  useEffect(() => {
    if (currentUser && canSendRemainder) {
      fetchUsers();
      fetchDepartments();
    }
  }, [currentUser, canSendRemainder, fetchUsers]);

  // Send Task Reminder
  const handleSendRemainder = async () => {
    if (!assignedDate || !dueDate) {
      toast.error("Please select both Assigned Date and Due Date");
      return;
    }

    // Ensure due date is after assigned date
    if (new Date(dueDate) <= new Date(assignedDate)) {
      toast.error("Due Date must be after Assigned Date");
      return;
    }

    if (!taskDescription.trim()) {
      toast.warn("Please fill description");
      return;
    }
    
    try {
      // Prepare assigned users (role-based)
      const usersToAssign =
      Number(currentUser?.role_id) === 5
      ? [currentUser.id] // Self-only if role_id = 5(users)
      : assignedUsers.map((u) => u.value);
      
      if (usersToAssign.length === 0) {
        toast.warning("Please assign at least one user");
        return;
      }
          
      // Create the reminder/task
      const res = await axios.post(
        `${API_URL}/api/reminders`,
        {
          description: taskDescription,
          users: usersToAssign,
          assignedDate,
          dueDate,
          priority: taskPriority,
          createdBy: currentUser.id,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const taskId = res.data?.taskId || res.data?.id;
      if (!taskId) {
        toast.warning("Task created but missing task ID in response");
      } else {
        // Add initial "New" status history for each user
        for (const userId of usersToAssign) {
          await axios.post(
            `${API_URL}/api/reminders/${taskId}/history`,
            {
              user_id: userId,
              status: "New",
              changed_by: currentUser.id,
            },
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      }
      toast.success("Task created and marked as New");

      // Reset fields
      setTaskDescription("");
      setAssignedUsers([]);
      setAssignedDate(new Date());
      setDueDate(null);
      setTaskPriority("Medium");
    } catch (err) {
      console.error(" Error creating reminder:", err);
      toast.error("Failed to send reminder");
    }
  };
  
  // Schedule Meeting
  const handleScheduleMeeting = async () => {
    if (!meetingDescription || !meetingDateTime || (!meetingDepts.length && !meetingUsers.length)) {
      toast.error("Please fill all fields for meeting");
      return;
    }
    try {
      let userIds = [];
      if (meetingUsers.length) {
        userIds = meetingUsers.map(u => u.value);
      } else if (meetingDepts.length) {
        const deptIds = meetingDepts.map(d => d.value);
        userIds = allUsers.filter(u => deptIds.includes(u.department)).map(u => u.value);
      }
      await axios.post(
        `${API_URL}/api/meetings`,
        {
          description: meetingDescription,
          date: meetingDateTime.toISOString().slice(0, 19).replace("T", " "),
          priority: meetingPriority,
          users: userIds,
          departments: meetingDepts.map(d => d.value),
          createdBy: currentUser.id,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      toast.success(` Meeting Scheduled Successfully for ${userIds.length} user(s).`);
      setMeetingDescription("");
      setMeetingDateTime(null);
      setMeetingDepts([]);
      setMeetingUsers([]);
      setMeetingPriority("Medium");
    } catch (err) {
      console.error(err);
      toast.error("Failed to schedule meeting");
    }
  };

  const handleAddUsersFromDept = () => {
    if (meetingDepts.length) {
      // Handle both name and ID cases gracefully
      const deptIds = meetingDepts.map(d => Number(d.value));
      const deptNames = meetingDepts.map(d => d.label.toLowerCase());

      const deptUsers = allUsers.filter(u => {
        const userDept = u.department?.toString().toLowerCase();
        return deptIds.includes(Number(userDept)) || deptNames.includes(userDept);
      });

      if (deptUsers.length > 0) {
        setMeetingUsers(prev => {
          const existing = new Set(prev.map(u => u.value));
          const newOnes = deptUsers.filter(u => !existing.has(u.value));
          return [...prev, ...newOnes];
        });
        toast.success(`${deptUsers.length} user(s) added from selected departments`);
      } else {
        toast.info("No users found for selected departments");
      }
    } else {
      toast.info("Select departments first");
    }
  };

  if (!canSendRemainder) return <div>You do not have permission to send reminders.</div>;

  return (
    <div style={{
      maxWidth: "750px",
      margin: "30px auto",
      padding: "25px",
      border: "1px solid #ddd",
      borderRadius: "12px",
      boxShadow: "0 2px 20px rgba(0,0,0,0.15)",
      backgroundColor: "#fff",
    }}>
      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", marginBottom: "20px", borderBottom: "2px solid #ddd" }}>
        <button onClick={()=>setActiveTab("task")} style={{flex:1,padding:"12px", backgroundColor: activeTab==="task"?"#007bff":"#f8f9fa", color: activeTab==="task"?"#fff":"#000", border:"none", fontWeight:"bold", cursor:"pointer"}}>Task Reminder</button>
        {!isSelfUser && (
          <button onClick={()=>setActiveTab("meeting")} style={{flex:1,padding:"12px", backgroundColor: activeTab==="meeting"?"#28a745":"#f8f9fa", color: activeTab==="meeting"?"#fff":"#000", border:"none", fontWeight:"bold", cursor:"pointer"}}>Schedule Meeting</button>
        )}
      </div>

      {/* Task Reminder */}
      {activeTab==="task" && (
        <>
          <h2 style={{textAlign:"center", color:"#007bff"}}> Task Reminder</h2>
          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Task Description:</label>
            <textarea value={taskDescription} onChange={e=>setTaskDescription(e.target.value)} rows={4} placeholder="Enter task details..." style={{width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ccc", marginTop:"6px"}} />
          </div>

          {/* Assign To Field (Role-based) */}
          <div style={{ marginBottom: "15px" }}>
            <label style={{ fontWeight: "bold" }}>Assign To:</label>

            {Number(currentUser?.role_id) === 5 ? (
            <div
              style={{
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "8px",
                backgroundColor: "#f8f9fa",
                marginTop: "6px",
                fontWeight: "500",
              }}
            >
              {currentUser?.name || "Current User"}
            </div>
            ) : (
              <>
                <div style={{ marginBottom: "6px" }}>
                  <button
                    type="button"
                    onClick={() => setAssignedUsers(allUsers)}
                    style={{
                      padding: "6px 12px",
                      fontSize: "14px",
                      backgroundColor: "#6c757d",
                      color: "#fff",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Assign to All
                  </button>
                </div>
                <Select
                  isMulti
                  options={allUsers}
                  value={assignedUsers}
                  onChange={setAssignedUsers}
                  placeholder="Select users..."
                />
              </>
            )}
          </div>

          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Assigned Date:</label>
            <DatePicker selected={assignedDate} onChange={setAssignedDate} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="MMMM d, yyyy h:mm aa" placeholderText="Select assigned date & time" className="form-control" />
          </div>

          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Due Date:</label>
            <DatePicker selected={dueDate} onChange={setDueDate} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="MMMM d, yyyy h:mm aa" placeholderText="Select due date & time" className="form-control" />
          </div>

          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Priority:</label>
            <PriorityBadge level={taskPriority} />
            <select className="form-select mt-2" value={taskPriority} onChange={e=>setTaskPriority(e.target.value)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div style={{textAlign:"center"}}>
            <button onClick={handleSendRemainder} style={{padding:"12px 24px", backgroundColor:"#007bff", color:"#fff", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"16px"}}>Send Reminder</button>
          </div>
        </>
      )}

      {/* Meeting */}
      {activeTab==="meeting" && (
        <>
          <h2 style={{textAlign:"center", color:"#28a745"}}>Schedule Meeting</h2>
          
          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Meeting Description:</label>
            <textarea value={meetingDescription} onChange={e=>setMeetingDescription(e.target.value)} rows={3} placeholder="Enter meeting details..." style={{width:"100%", padding:"10px", borderRadius:"8px", border:"1px solid #ccc", marginTop:"6px"}} />
          </div>

          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Departments:</label>
            <Select isMulti options={departments.map(d=>({value:d.id,label:d.name}))} value={meetingDepts} onChange={setMeetingDepts} placeholder="Select departments..." />
          </div>

          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Assign Users:</label>
            <div style={{marginBottom:"6px"}}>
              <button type="button" onClick={()=>setMeetingUsers(allUsers)} style={{padding:"6px 12px", fontSize:"14px", backgroundColor:"#6c757d", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer", marginRight:"6px"}}>Assign to All Users</button>
              <button onClick={handleAddUsersFromDept} variant="primary"
                style={{padding:"6px 12px", fontSize:"14px", backgroundColor:"#17a2b8", color:"#fff", border:"none", borderRadius:"6px", cursor:"pointer" }}>
                Assign Department Users
              </button>
            </div>
            <Select isMulti options={allUsers} value={meetingUsers} onChange={setMeetingUsers} placeholder="Select users..." />
          </div>

          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Priority:</label>
            <PriorityBadge level={meetingPriority} />
            <select className="form-select mt-2" value={meetingPriority} onChange={e=>setMeetingPriority(e.target.value)}>
              <option>High</option>
              <option>Medium</option>
              <option>Low</option>
            </select>
          </div>

          <div style={{marginBottom:"15px"}}>
            <label style={{fontWeight:"bold"}}>Meeting Date & Time:</label>
            <DatePicker selected={meetingDateTime} onChange={setMeetingDateTime} showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="MMMM d, yyyy h:mm aa" placeholderText="Select meeting date & time" className="form-control" />
          </div>

          <div style={{textAlign:"center"}}>
            <button onClick={handleScheduleMeeting} style={{padding:"12px 24px", backgroundColor:"#28a745", color:"#fff", border:"none", borderRadius:"8px", cursor:"pointer", fontSize:"16px"}}>Schedule Meeting</button>
          </div>
        </>
      )}
      <ToastContainer position="top-center" autoClose={2500} />
    </div>
  );
};

export default Remainders;
