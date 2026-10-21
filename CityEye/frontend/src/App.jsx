import React, { useState, useEffect, useCallback } from "react";
import Navbar from "./components/Navbar";
import OfficerDashboard from "./components/OfficerDashboard";
import WorkTeamDashboard from "./components/WorkTeamDashboard";
import SeniorOfficerDashboard from "./components/SeniorOfficerDashboard";
import { api, getAuthToken, setAuthToken, removeAuthToken, getStoredUser, setStoredUser, removeStoredUser } from "./api";
import { Play, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export default function App() {
  const [currentUser, setCurrentUser] = useState(getStoredUser());
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [cameras, setCameras] = useState([]);
  const [workTeams, setWorkTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState("success");
  const [isSimulating, setIsSimulating] = useState(false);

  const showToast = (msg, type = "success") => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Switch role or perform login
  const handleLogin = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await api.login(email, password);
      setCurrentUser(data.user);
      showToast(`Logged in as ${data.user.name} (${data.user.role.toUpperCase()})`);
    } catch (err) {
      showToast(err.message || "Login failed", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    removeStoredUser();
    setCurrentUser(null);
    showToast("Signed out", "info");
  };

  // Fetch all dashboard data for active user
  const fetchData = useCallback(async () => {
    if (!currentUser) return;
    setIsRefreshing(true);
    try {
      const [statsData, reportsData] = await Promise.all([
        api.getDashboardStats().catch(() => null),
        api.getReports().catch(() => []),
      ]);
      setStats(statsData);
      setReports(reportsData);

      if (currentUser.role === "officer" || currentUser.role === "senior_officer") {
        const cams = await api.getCameras().catch(() => []);
        setCameras(cams);
      }

      if (currentUser.role === "officer") {
        const teams = await api.getWorkTeams().catch(() => []);
        setWorkTeams(teams);
      }
    } catch (err) {
      console.error("Data fetch error:", err);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [currentUser]);

  // Initial auto-login as officer if no token present
  useEffect(() => {
    const initAuth = async () => {
      const token = getAuthToken();
      if (!token) {
        // Auto demo login as municipal officer
        await handleLogin("officer@cityeye.gov", "Officer@123");
      } else {
        try {
          const user = await api.getMe();
          setCurrentUser(user);
          setStoredUser(user);
        } catch (err) {
          // Token expired or invalid, re-login
          await handleLogin("officer@cityeye.gov", "Officer@123");
        }
      }
    };
    initAuth();
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchData();
    }
  }, [currentUser, fetchData]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          background: toastType === "error" ? "rgba(239, 68, 68, 0.95)" : "rgba(16, 185, 129, 0.95)",
          color: "#fff",
          padding: "12px 20px",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontWeight: "500",
          fontSize: "0.875rem",
          backdropFilter: "blur(8px)",
          animation: "modalIn 0.2s ease"
        }}>
          {toastType === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        onSwitchUser={handleLogin}
        onLogout={handleLogout}
        onRefresh={fetchData}
        isRefreshing={isRefreshing}
      />

      {/* Main Content View Container */}
      <main style={{ flex: 1 }}>
        {isLoading && !currentUser ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "60vh", color: "var(--text-muted)" }}>
            <RefreshCw size={36} className="spin-animation" style={{ color: "var(--primary)", marginBottom: "16px" }} />
            <h3 style={{ color: "#fff" }}>Connecting to CityEye Municipal AI Core...</h3>
          </div>
        ) : !currentUser ? (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <h2 style={{ color: "#fff", marginBottom: "12px" }}>Authentication Required</h2>
            <p style={{ color: "var(--text-muted)", marginBottom: "20px" }}>Please select a role from the top navigation bar to enter the dashboard.</p>
            <button onClick={() => handleLogin("officer@cityeye.gov", "Officer@123")} className="btn-primary">
              Log in as Officer
            </button>
          </div>
        ) : currentUser.role === "officer" ? (
          <OfficerDashboard
            stats={stats}
            reports={reports}
            workTeams={workTeams}
            onActionSuccess={(msg) => {
              showToast(msg);
              fetchData();
            }}
          />
        ) : currentUser.role === "work_team" ? (
          <WorkTeamDashboard
            currentUser={currentUser}
            stats={stats}
            reports={reports}
            onActionSuccess={(msg) => {
              showToast(msg);
              fetchData();
            }}
          />
        ) : (
          <SeniorOfficerDashboard
            stats={stats}
            reports={reports}
            cameras={cameras}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        marginTop: "auto",
        borderTop: "1px solid var(--border-color)",
        padding: "16px 24px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontSize: "0.75rem",
        color: "var(--text-subtle)",
        background: "var(--bg-secondary)"
      }}>
        <div>
          CityEye v2.0 • YOLOv8 Multi-Frame Temporal Verification & CLAHE Pipeline • Municipal Corporation Architecture
        </div>
        <div>
          Role Active: <strong style={{ color: "var(--text-muted)" }}>{currentUser?.role?.toUpperCase()}</strong> • Single-Camera Validation Standard
        </div>
      </footer>
    </div>
  );
}
