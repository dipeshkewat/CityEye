import React, { useState } from "react";
import { Wrench, PlayCircle, CheckCircle, Upload, Clock, MapPin, Image as ImageIcon, AlertCircle } from "lucide-react";
import { api } from "../api";

export default function WorkTeamDashboard({ currentUser, stats, reports, onActionSuccess }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalType, setModalType] = useState(null); // 'resolve'
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionFile, setResolutionFile] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const assignedTasks = reports.filter((r) => r.status === "assigned");
  const inProgressTasks = reports.filter((r) => r.status === "in_progress");
  const resolvedTasks = reports.filter((r) => r.status === "resolved");

  const handleStartWork = async (reportId) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.startProgress(reportId);
      onActionSuccess("Work status updated to 'In Progress'.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to start progress");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveSubmit = async (e) => {
    e.preventDefault();
    if (!resolutionNotes.trim() || resolutionNotes.trim().length < 5) {
      setErrorMsg("Resolution notes must be at least 5 characters long.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      let photoPath = null;
      if (resolutionFile) {
        const uploadResult = await api.uploadResolutionPhoto(resolutionFile);
        photoPath = uploadResult.filepath;
      }

      await api.resolveReport(selectedReport.id, resolutionNotes, photoPath);
      setModalType(null);
      setResolutionNotes("");
      setResolutionFile(null);
      setSelectedReport(null);
      onActionSuccess("Defect marked as resolved with photo evidence!");
    } catch (err) {
      setErrorMsg(err.message || "Failed to resolve report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "0 20px 40px 20px" }}>
      {/* Team Header & Security Banner */}
      <div className="glass-panel" style={{ padding: "18px 24px", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 className="font-display" style={{ fontSize: "1.4rem", fontWeight: "700", color: "#fff" }}>
              Field Operations: {currentUser?.team_name || "Assigned Crew"}
            </h2>
            <span className="badge badge-in_progress">
              Field Execution Active
            </span>
          </div>
          <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Operative: <strong>{currentUser?.name}</strong> • Strict server-side row-level isolation active per Security Spec §4.
          </p>
        </div>

        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", textTransform: "uppercase" }}>Active Tasks</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--accent-cyan)" }}>
              {assignedTasks.length + inProgressTasks.length}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", textTransform: "uppercase" }}>Completed</div>
            <div style={{ fontSize: "1.5rem", fontWeight: "700", color: "var(--accent-emerald)" }}>
              {resolvedTasks.length}
            </div>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.3)", color: "#f87171", borderRadius: "8px", marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
          <AlertCircle size={18} /> {errorMsg}
        </div>
      )}

      {/* Grid of Active Tasks */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "36px" }}>
        
        {/* Assigned Queue */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 className="font-display" style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
              <Clock size={18} style={{ color: "var(--status-assigned)" }} /> Assigned Orders ({assignedTasks.length})
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>Awaiting dispatch start</span>
          </div>

          {assignedTasks.length === 0 ? (
            <div className="glass-panel" style={{ padding: "30px", textAlign: "center", color: "var(--text-subtle)" }}>
              No newly assigned orders at this time.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {assignedTasks.map((task) => (
                <div key={task.id} className="glass-card" style={{ padding: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <span className="badge badge-assigned">Assigned Order</span>
                    <span className={`badge badge-sev-${task.severity_label || "medium"}`}>
                      {task.severity_label}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "1rem", fontWeight: "600", color: "#fff", marginBottom: "6px" }}>
                    {task.title}
                  </h4>
                  <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                    {task.description}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)", display: "flex", alignItems: "center", gap: "4px" }}>
                      <MapPin size={12} /> {task.recommended_department}
                    </span>
                    <button
                      onClick={() => handleStartWork(task.id)}
                      disabled={isSubmitting}
                      className="btn-primary"
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    >
                      <PlayCircle size={14} /> Start Work
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* In-Progress Queue */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 className="font-display" style={{ fontSize: "1.2rem", fontWeight: "700", display: "flex", alignItems: "center", gap: "8px" }}>
              <Wrench size={18} style={{ color: "var(--accent-cyan)" }} /> In Progress ({inProgressTasks.length})
            </h3>
            <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>Active repair on site</span>
          </div>

          {inProgressTasks.length === 0 ? (
            <div className="glass-panel" style={{ padding: "30px", textAlign: "center", color: "var(--text-subtle)" }}>
              No repairs currently marked in-progress.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {inProgressTasks.map((task) => (
                <div key={task.id} className="glass-card" style={{ padding: "16px", borderLeft: "4px solid var(--accent-cyan)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <span className="badge badge-in_progress">Work In Progress</span>
                    <span className={`badge badge-sev-${task.severity_label || "medium"}`}>
                      {task.severity_label}
                    </span>
                  </div>
                  <h4 style={{ fontSize: "1rem", fontWeight: "600", color: "#fff", marginBottom: "6px" }}>
                    {task.title}
                  </h4>
                  <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginBottom: "12px" }}>
                    {task.description}
                  </p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "10px", borderTop: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-subtle)" }}>
                      Started: {task.in_progress_at ? new Date(task.in_progress_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Active"}
                    </span>
                    <button
                      onClick={() => {
                        setSelectedReport(task);
                        setModalType("resolve");
                        setResolutionNotes("");
                        setResolutionFile(null);
                      }}
                      className="btn-success"
                      style={{ padding: "6px 14px", fontSize: "0.8rem" }}
                    >
                      <CheckCircle size={14} /> Submit Resolution
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Completed Repairs History */}
      <div>
        <h3 className="font-display" style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "14px" }}>
          Squad Resolution Log ({resolvedTasks.length})
        </h3>
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-subtle)" }}>
                <th style={{ padding: "12px 16px" }}>ID</th>
                <th style={{ padding: "12px 16px" }}>Defect & Location</th>
                <th style={{ padding: "12px 16px" }}>Resolution Notes</th>
                <th style={{ padding: "12px 16px" }}>Proof Photo</th>
                <th style={{ padding: "12px 16px" }}>Resolved At</th>
              </tr>
            </thead>
            <tbody>
              {resolvedTasks.map((task) => (
                <tr key={task.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--text-subtle)" }}>{task.id}</td>
                  <td style={{ padding: "12px 16px", fontWeight: "500", color: "#fff" }}>{task.title}</td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{task.resolution_notes || "—"}</td>
                  <td style={{ padding: "12px 16px" }}>
                    {task.resolution_photo_path ? (
                      <a
                        href={api.getImageUrl(task.resolution_photo_path)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: "var(--accent-cyan)", display: "flex", alignItems: "center", gap: "4px", textDecoration: "none" }}
                      >
                        <ImageIcon size={14} /> View Proof
                      </a>
                    ) : (
                      <span style={{ color: "var(--text-subtle)" }}>None</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-subtle)" }}>
                    {task.resolved_at ? new Date(task.resolved_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Resolution Submission Modal */}
      {modalType === "resolve" && selectedReport && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "24px", maxWidth: "520px" }}>
            <h3 style={{ fontSize: "1.2rem", color: "var(--accent-emerald)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <CheckCircle size={20} /> Submit Defect Resolution
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Resolving <strong>{selectedReport.title}</strong> requires both mandatory repair notes and photographic proof per Acceptance Criteria §10.
            </p>

            <form onSubmit={handleResolveSubmit}>
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                  Resolution Notes (Required):
                </label>
                <textarea
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="E.g., Hot-mix asphalt compacted, drainage blockage cleared, curb cleaned..."
                  rows={3}
                  required
                  style={{
                    width: "100%",
                    background: "var(--bg-tertiary)",
                    color: "#fff",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    padding: "10px",
                    fontSize: "0.85rem",
                  }}
                />
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "6px" }}>
                  Proof-of-Fix Image:
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => setResolutionFile(e.target.files[0])}
                  style={{
                    width: "100%",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-muted)",
                    padding: "8px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px dashed var(--border-color)",
                    fontSize: "0.8rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setModalType(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-success">
                  {isSubmitting ? "Uploading..." : "Complete & Close Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
