import React, { useState } from "react";
import { CheckCircle2, XCircle, UserPlus, AlertTriangle, Eye, ShieldAlert, Sparkles, MapPin, Clock } from "lucide-react";
import { api } from "../api";

export default function OfficerDashboard({ stats, reports, workTeams, onActionSuccess }) {
  const [selectedReport, setSelectedReport] = useState(null);
  const [modalType, setModalType] = useState(null); // 'review_reject', 'assign', 'view_image'
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const pendingReports = reports.filter((r) => r.status === "pending_officer_review");
  const reviewedReports = reports.filter((r) => r.status !== "pending_officer_review");

  const handleApprove = async (reportId) => {
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.reviewReport(reportId, "approved");
      onActionSuccess("Report approved successfully. Ready for assignment.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to approve report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e) => {
    e.preventDefault();
    if (!rejectionReason.trim()) {
      setErrorMsg("Rejection reason is mandatory.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.reviewReport(selectedReport.id, "rejected", rejectionReason);
      setModalType(null);
      setRejectionReason("");
      setSelectedReport(null);
      onActionSuccess("Report rejected and logged in municipal audit trail.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to reject report");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      setErrorMsg("Please select a target work team.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await api.assignReport(selectedReport.id, selectedTeamId);
      setModalType(null);
      setSelectedTeamId("");
      setSelectedReport(null);
      onActionSuccess("Report assigned to work team.");
    } catch (err) {
      setErrorMsg(err.message || "Failed to assign report");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: "0 20px 40px 20px" }}>
      {/* KPI Ribbon */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "16px",
        marginBottom: "28px"
      }}>
        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ color: "var(--accent-amber)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>
            Pending Review
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", marginTop: "4px" }}>
            {stats?.summary?.pending_review ?? pendingReports.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Requires Officer Verification
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ color: "var(--status-assigned)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>
            Assigned to Teams
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", marginTop: "4px" }}>
            {stats?.summary?.assigned ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Awaiting Field Crew Execution
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ color: "var(--accent-emerald)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>
            Resolved
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", marginTop: "4px" }}>
            {stats?.summary?.resolved ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Repaired with photographic proof
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <div style={{ color: "var(--accent-cyan)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase" }}>
            Active CCTVs
          </div>
          <div style={{ fontSize: "2.25rem", fontWeight: "800", marginTop: "4px" }}>
            {stats?.summary?.active_cameras ?? 5}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Mumbai Civic Junctions
          </div>
        </div>
      </div>

      {/* Review Queue Section */}
      <div style={{ marginBottom: "36px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 className="font-display" style={{ fontSize: "1.4rem", fontWeight: "700" }}>
              Action Queue: Pending Officer Review
            </h2>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Detections verified across continuous frames. Approve to route or reject with reason.
            </p>
          </div>
          <span className="badge badge-pending">
            {pendingReports.length} ACTION REQUIRED
          </span>
        </div>

        {pendingReports.length === 0 ? (
          <div className="glass-panel" style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>
            <CheckCircle2 size={42} style={{ color: "var(--accent-emerald)", margin: "0 auto 12px auto" }} />
            <h3 style={{ color: "#fff", marginBottom: "6px" }}>Review Queue Clear!</h3>
            <p>All temporal AI detections have been reviewed and assigned.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "20px" }}>
            {pendingReports.map((report) => {
              const imgUrl = api.getImageUrl(report.evidence_image_path);
              const sevBadgeClass = `badge-sev-${report.severity_label || "medium"}`;

              return (
                <div key={report.id} className="glass-card" style={{ padding: "18px", display: "flex", flexDirection: "column" }}>
                  {/* Image container */}
                  <div
                    style={{
                      position: "relative",
                      borderRadius: "var(--radius-sm)",
                      overflow: "hidden",
                      height: "190px",
                      background: "#1e293b",
                      cursor: "pointer",
                      marginBottom: "14px",
                    }}
                    onClick={() => {
                      setSelectedReport(report);
                      setModalType("view_image");
                    }}
                  >
                    {imgUrl ? (
                      <img
                        src={imgUrl}
                        alt={report.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        No Image
                      </div>
                    )}

                    <div style={{
                      position: "absolute",
                      top: "8px",
                      left: "8px",
                      display: "flex",
                      gap: "6px"
                    }}>
                      <span className={`badge ${sevBadgeClass}`}>
                        {report.severity_label || "MEDIUM"} ({(report.severity_score ?? 0.5).toFixed(2)})
                      </span>
                    </div>

                    <div style={{
                      position: "absolute",
                      bottom: "8px",
                      left: "8px",
                      right: "8px",
                      background: "rgba(0,0,0,0.65)",
                      backdropFilter: "blur(4px)",
                      borderRadius: "4px",
                      padding: "4px 8px",
                      fontSize: "0.75rem",
                      display: "flex",
                      justifyContent: "space-between",
                      color: "#cbd5e1"
                    }}>
                      <span>Verified: {report.confirmed_frame_count} frames</span>
                      <span style={{ color: "var(--accent-cyan)" }}>CLAHE Enhanced</span>
                    </div>
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                      <Clock size={12} /> {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ID: {report.id}
                    </div>
                    <h3 style={{ fontSize: "1.05rem", fontWeight: "600", marginBottom: "8px", color: "#fff" }}>
                      {report.title}
                    </h3>
                    <p style={{ fontSize: "0.825rem", color: "var(--text-muted)", marginBottom: "14px", lineHeight: "1.4" }}>
                      {report.description}
                    </p>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.75rem", color: "var(--text-subtle)", marginBottom: "16px" }}>
                      <MapPin size={13} style={{ color: "var(--accent-rose)" }} />
                      <span>Dept: <strong>{report.recommended_department}</strong></span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", gap: "8px", paddingTop: "12px", borderTop: "1px solid var(--border-color)" }}>
                    <button
                      onClick={() => handleApprove(report.id)}
                      disabled={isSubmitting}
                      className="btn-success"
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <CheckCircle2 size={15} /> Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReport(report);
                        setModalType("assign");
                      }}
                      className="btn-primary"
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <UserPlus size={15} /> Assign
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReport(report);
                        setModalType("review_reject");
                        setRejectionReason("");
                      }}
                      className="btn-danger"
                      style={{ padding: "8px 12px" }}
                      title="Reject Report"
                    >
                      <XCircle size={15} />
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historical Audit Table */}
      <div>
        <h2 className="font-display" style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "14px" }}>
          Municipal Action Audit Log
        </h2>
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-subtle)" }}>
                <th style={{ padding: "12px 16px" }}>ID</th>
                <th style={{ padding: "12px 16px" }}>Title & Location</th>
                <th style={{ padding: "12px 16px" }}>Problem Type</th>
                <th style={{ padding: "12px 16px" }}>Severity</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Assigned Crew</th>
              </tr>
            </thead>
            <tbody>
              {reviewedReports.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--text-subtle)" }}>{r.id}</td>
                  <td style={{ padding: "12px 16px", fontWeight: "500", color: "#fff" }}>
                    <div>{r.title}</div>
                    {r.rejection_reason && (
                      <div style={{ fontSize: "0.75rem", color: "var(--accent-rose)", marginTop: "2px" }}>
                        Reason: {r.rejection_reason}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textTransform: "capitalize" }}>{r.problem_type}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className={`badge badge-sev-${r.severity_label || "medium"}`}>
                      {r.severity_label}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span className={`badge badge-${r.status}`}>
                      {r.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>
                    {r.assignee?.team_name || r.assignee?.name || (r.status === "approved" ? "Pending Assign" : "—")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {modalType === "review_reject" && selectedReport && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "24px", maxWidth: "480px" }}>
            <h3 style={{ fontSize: "1.2rem", color: "var(--accent-rose)", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={20} /> Reject Incident Report
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Per Section 4 of the Security Spec, rejecting a report is terminal and strictly requires an audit reason.
            </p>
            {errorMsg && (
              <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderRadius: "6px", marginBottom: "12px", fontSize: "0.85rem" }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleRejectSubmit}>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="E.g., Temporary road surface shadow / optical reflection; not an active crater..."
                rows={4}
                required
                style={{
                  width: "100%",
                  background: "var(--bg-tertiary)",
                  color: "#fff",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setModalType(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-danger">
                  Confirm Rejection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {modalType === "assign" && selectedReport && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "24px", maxWidth: "480px" }}>
            <h3 style={{ fontSize: "1.2rem", color: "#fff", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}>
              <UserPlus size={20} style={{ color: "var(--primary)" }} /> Assign to Work Crew
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "16px" }}>
              Assign <strong>{selectedReport.title}</strong> to an active municipal field squad:
            </p>
            {errorMsg && (
              <div style={{ padding: "8px 12px", background: "rgba(239, 68, 68, 0.15)", color: "#f87171", borderRadius: "6px", marginBottom: "12px", fontSize: "0.85rem" }}>
                {errorMsg}
              </div>
            )}
            <form onSubmit={handleAssignSubmit}>
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                required
                style={{
                  width: "100%",
                  background: "var(--bg-tertiary)",
                  color: "#fff",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-sm)",
                  padding: "10px",
                  fontSize: "0.9rem",
                  marginBottom: "20px",
                }}
              >
                <option value="">-- Choose Field Squad --</option>
                {workTeams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.team_name || "Field Team"})
                  </option>
                ))}
              </select>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button type="button" onClick={() => setModalType(null)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn-primary">
                  Assign & Dispatch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Full Image Modal */}
      {modalType === "view_image" && selectedReport && (
        <div className="modal-overlay" onClick={() => setModalType(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ padding: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ fontSize: "1.1rem", color: "#fff" }}>{selectedReport.title}</h3>
              <button onClick={() => setModalType(null)} className="btn-secondary" style={{ padding: "4px 8px" }}>
                ✕
              </button>
            </div>
            <img
              src={api.getImageUrl(selectedReport.evidence_image_path)}
              alt="High Res Evidence"
              style={{ width: "100%", borderRadius: "8px", maxHeight: "65vh", objectFit: "contain", background: "#000" }}
            />
            <div style={{ marginTop: "12px", fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
              <span>Confidence: {((selectedReport.confidence ?? 0.9) * 100).toFixed(1)}%</span>
              <span>Temporal Confirmation: {selectedReport.confirmed_frame_count} frames</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
