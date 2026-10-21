import React from "react";
import { ShieldCheck, Wrench, Eye, LogOut, Radio, RefreshCw } from "lucide-react";

export default function Navbar({ currentUser, onSwitchUser, onLogout, onRefresh, isRefreshing }) {
  const roles = [
    {
      id: "officer",
      name: "Officer",
      user: "Vikram Deshmukh",
      email: "officer@cityeye.gov",
      pass: "Officer@123",
      icon: ShieldCheck,
      color: "var(--accent-amber)",
    },
    {
      id: "work_team",
      name: "Work Team",
      user: "Ramesh Patil (Crew 2)",
      email: "crew1@cityeye.gov",
      pass: "Crew@123",
      icon: Wrench,
      color: "var(--accent-cyan)",
    },
    {
      id: "senior_officer",
      name: "Senior Oversight",
      user: "Dr. Ananya Mehta",
      email: "senior@cityeye.gov",
      pass: "Senior@123",
      icon: Eye,
      color: "var(--accent-emerald)",
    },
  ];

  return (
    <header className="glass-panel" style={{ margin: "16px 20px 24px 20px", padding: "12px 24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        
        {/* Brand */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{
            width: "42px",
            height: "42px",
            borderRadius: "12px",
            background: "linear-gradient(135deg, #4f46e5, #06b6d4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "22px",
            boxShadow: "0 0 20px rgba(79, 70, 229, 0.4)"
          }}>
            👁️
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 className="font-display" style={{ fontSize: "1.35rem", fontWeight: "700", color: "#fff" }}>
                CityEye AI
              </h1>
              <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
                <Radio size={12} style={{ animation: "pulse 1.5s infinite" }} /> Live Core
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              Municipal Infrastructure Computer Vision & Verification
            </p>
          </div>
        </div>

        {/* Demo Role Switcher */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "rgba(0, 0, 0, 0.25)",
          padding: "4px 8px",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-color)",
          flexWrap: "wrap"
        }}>
          <span style={{ fontSize: "0.75rem", fontWeight: "600", color: "var(--text-subtle)", padding: "0 4px" }}>
            DEMO ROLES:
          </span>
          {roles.map((r) => {
            const Icon = r.icon;
            const isActive = currentUser && currentUser.role === r.id;
            return (
              <button
                key={r.id}
                onClick={() => onSwitchUser(r.email, r.pass)}
                style={{
                  background: isActive ? "rgba(255, 255, 255, 0.12)" : "transparent",
                  color: isActive ? "#ffffff" : "var(--text-muted)",
                  border: isActive ? `1px solid ${r.color}` : "1px solid transparent",
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem",
                  fontWeight: isActive ? "600" : "500",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer",
                }}
                title={`Switch to ${r.user} (${r.name})`}
              >
                <Icon size={14} style={{ color: r.color }} />
                <span>{r.name}</span>
                {isActive && (
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: r.color }} />
                )}
              </button>
            );
          })}
        </div>

        {/* User Info & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {currentUser && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.875rem", fontWeight: "600", color: "#fff" }}>
                {currentUser.name}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {currentUser.team_name || currentUser.role}
              </div>
            </div>
          )}

          <button
            onClick={onRefresh}
            className="btn-secondary"
            style={{ padding: "8px 10px" }}
            title="Refresh Data"
          >
            <RefreshCw size={15} className={isRefreshing ? "spin-animation" : ""} />
          </button>

          <button
            onClick={onLogout}
            className="btn-secondary"
            style={{ padding: "8px 10px" }}
            title="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>

      </div>
    </header>
  );
}
