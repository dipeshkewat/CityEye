import React, { useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, CircleMarker } from "react-leaflet";
import L from "leaflet";
import { BarChart3, MapPin, Shield, Layers, Camera as CameraIcon, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { api } from "../api";

// Fix standard Leaflet default icon bug in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const getStatusColor = (status) => {
  switch (status) {
    case "pending_officer_review": return "#f59e0b"; // amber
    case "approved": return "#3b82f6"; // blue
    case "assigned": return "#8b5cf6"; // purple
    case "in_progress": return "#06b6d4"; // cyan
    case "resolved": return "#10b981"; // emerald
    case "rejected": return "#ef4444"; // red
    default: return "#64748b";
  }
};

export default function SeniorOfficerDashboard({ stats, reports, cameras }) {
  const [filterDept, setFilterDept] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filteredReports = reports.filter((r) => {
    if (filterDept !== "all" && r.recommended_department !== filterDept) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    return true;
  });

  const mumbaiCenter = [19.0600, 72.8450]; // Bandra / Central Mumbai

  return (
    <div style={{ padding: "0 20px 40px 20px" }}>
      {/* Executive Oversight Banner */}
      <div className="glass-panel" style={{ padding: "20px 24px", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <h2 className="font-display" style={{ fontSize: "1.45rem", fontWeight: "800", color: "#fff" }}>
              Municipal Commissionerate — Executive GIS Oversight
            </h2>
            <span className="badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399", border: "1px solid rgba(16, 185, 129, 0.3)" }}>
              <Shield size={12} /> Strictly Read-Only (Auditor View)
            </span>
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Real-time geospatial analytics across all municipal wards, camera nodes, and resolution crews.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              background: "var(--bg-tertiary)",
              color: "#fff",
              border: "1px solid var(--border-color)",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
            }}
          >
            <option value="all">All Statuses</option>
            <option value="pending_officer_review">Pending Review</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            style={{
              background: "var(--bg-tertiary)",
              color: "#fff",
              border: "1px solid var(--border-color)",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              fontSize: "0.8rem",
            }}
          >
            <option value="all">All Departments</option>
            <option value="Road Maintenance Department">Road Maintenance</option>
            <option value="Sanitation Department">Sanitation</option>
            <option value="Drainage & Public Works Department">Drainage & Public Works</option>
          </select>
        </div>
      </div>

      {/* High-Level Macro KPI Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--text-subtle)", fontWeight: "600", textTransform: "uppercase" }}>
            Total Incidents
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", marginTop: "2px" }}>
            {stats?.summary?.total_reports ?? reports.length}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Detected by CityEye AI
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-amber)", fontWeight: "600", textTransform: "uppercase" }}>
            Pending Queue
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", marginTop: "2px", color: "var(--accent-amber)" }}>
            {stats?.summary?.pending_review ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Awaiting Officer Action
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-cyan)", fontWeight: "600", textTransform: "uppercase" }}>
            Active Repairs
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", marginTop: "2px", color: "var(--accent-cyan)" }}>
            {(stats?.summary?.assigned ?? 0) + (stats?.summary?.in_progress ?? 0)}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            In Progress across Crews
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-emerald)", fontWeight: "600", textTransform: "uppercase" }}>
            Fixed & Resolved
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", marginTop: "2px", color: "var(--accent-emerald)" }}>
            {stats?.summary?.resolved ?? 0}
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            Verified with photographic proof
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "18px" }}>
          <div style={{ fontSize: "0.75rem", color: "var(--accent-purple)", fontWeight: "600", textTransform: "uppercase" }}>
            CCTV Coverage
          </div>
          <div style={{ fontSize: "2rem", fontWeight: "800", marginTop: "2px", color: "var(--accent-purple)" }}>
            {cameras.length} Nodes
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "4px" }}>
            100% Single-Camera Streams
          </div>
        </div>
      </div>

      {/* Interactive GIS CCTV Map */}
      <div className="glass-panel" style={{ padding: "20px", marginBottom: "32px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div>
            <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>
              <MapPin size={20} style={{ color: "var(--accent-cyan)" }} /> Interactive Municipal GIS CCTV Grid
            </h3>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Locations of monitored street CCTV feeds and active defect candidate overlays.
            </p>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", gap: "12px", fontSize: "0.75rem", alignItems: "center" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#f59e0b" }} /> Pending
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#8b5cf6" }} /> Assigned
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#06b6d4" }} /> In Progress
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#10b981" }} /> Resolved
            </span>
          </div>
        </div>

        {/* Map Container */}
        <div style={{ height: "460px", width: "100%", borderRadius: "12px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
          <MapContainer center={mumbaiCenter} zoom={12} style={{ height: "100%", width: "100%" }}>
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {/* Camera Nodes */}
            {cameras.map((cam) => (
              <Marker key={cam.id} position={[cam.latitude, cam.longitude]}>
                <Popup>
                  <div style={{ minWidth: "200px" }}>
                    <h4 style={{ fontWeight: "700", fontSize: "0.95rem", marginBottom: "4px", color: "#fff" }}>
                      🎥 {cam.name}
                    </h4>
                    <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "8px" }}>
                      {cam.address}
                    </p>
                    <div style={{ fontSize: "0.75rem", color: "#22d3ee" }}>
                      Status: Active CCTV Feed (CLAHE Active)
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Defect Incidents Colored by Status */}
            {filteredReports.map((rep) => {
              const cam = cameras.find((c) => c.id === rep.camera_id) || cameras[0];
              if (!cam) return null;
              // Add a slight jitter so multiple incidents at same camera don't completely overlap
              const hash = (rep.id.charCodeAt(rep.id.length - 1) % 5) * 0.001;
              const pos = [cam.latitude + hash, cam.longitude + hash];
              const color = getStatusColor(rep.status);

              return (
                <CircleMarker
                  key={rep.id}
                  center={pos}
                  radius={12}
                  pathOptions={{
                    fillColor: color,
                    fillOpacity: 0.85,
                    color: "#ffffff",
                    weight: 2,
                  }}
                >
                  <Popup>
                    <div style={{ minWidth: "240px" }}>
                      <span className={`badge badge-${rep.status}`} style={{ marginBottom: "6px", display: "inline-block" }}>
                        {rep.status.replace(/_/g, " ")}
                      </span>
                      <h4 style={{ fontWeight: "700", fontSize: "0.95rem", color: "#fff", marginBottom: "4px" }}>
                        {rep.title}
                      </h4>
                      <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "8px" }}>
                        {rep.description}
                      </p>
                      <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
                        Severity: <strong>{rep.severity_label?.toUpperCase()}</strong> (Score: {rep.severity_score})
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginTop: "2px" }}>
                        Department: <strong>{rep.recommended_department}</strong>
                      </div>
                      {rep.evidence_image_path && (
                        <div style={{ marginTop: "8px" }}>
                          <img
                            src={api.getImageUrl(rep.evidence_image_path)}
                            alt="Incident Evidence"
                            style={{ width: "100%", borderRadius: "4px", maxHeight: "100px", objectFit: "cover" }}
                          />
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>
        </div>
      </div>

      {/* Department Breakdown & Macro Analytics */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "32px" }}>
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 className="font-display" style={{ fontSize: "1.15rem", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={18} style={{ color: "var(--accent-cyan)" }} /> Departmental Incident Distribution
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {Object.entries(stats?.breakdown_by_department || {}).map(([dept, count]) => {
              const total = stats?.summary?.total_reports || 1;
              const pct = Math.round((count / total) * 100);
              return (
                <div key={dept}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px" }}>
                    <span>{dept}</span>
                    <span style={{ fontWeight: "600", color: "#fff" }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg, #4f46e5, #06b6d4)", borderRadius: "4px" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 className="font-display" style={{ fontSize: "1.15rem", fontWeight: "700", marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={18} style={{ color: "var(--accent-amber)" }} /> Severity Hazard Spread
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {["high", "medium", "low"].map((sev) => {
              const count = stats?.breakdown_by_severity?.[sev] || 0;
              const total = stats?.summary?.total_reports || 1;
              const pct = Math.round((count / total) * 100);
              const color = sev === "high" ? "var(--accent-rose)" : sev === "medium" ? "var(--accent-amber)" : "var(--accent-emerald)";
              return (
                <div key={sev}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "4px", textTransform: "capitalize" }}>
                    <span>{sev} Severity Hazards</span>
                    <span style={{ fontWeight: "600", color }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ height: "8px", background: "rgba(255,255,255,0.08)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "4px" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Incident Audit Table (Read-Only) */}
      <div>
        <h3 className="font-display" style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "14px" }}>
          City-Wide Defect Master Registry ({filteredReports.length})
        </h3>
        <div className="glass-panel" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", textAlign: "left" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)", color: "var(--text-subtle)" }}>
                <th style={{ padding: "12px 16px" }}>ID</th>
                <th style={{ padding: "12px 16px" }}>Incident</th>
                <th style={{ padding: "12px 16px" }}>Department</th>
                <th style={{ padding: "12px 16px" }}>Severity</th>
                <th style={{ padding: "12px 16px" }}>Status</th>
                <th style={{ padding: "12px 16px" }}>Assigned Crew</th>
                <th style={{ padding: "12px 16px" }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <td style={{ padding: "12px 16px", fontFamily: "monospace", color: "var(--text-subtle)" }}>{r.id}</td>
                  <td style={{ padding: "12px 16px", fontWeight: "500", color: "#fff" }}>
                    <div>{r.title}</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{r.description}</div>
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{r.recommended_department}</td>
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
                    {r.assignee?.team_name || r.assignee?.name || "—"}
                  </td>
                  <td style={{ padding: "12px 16px", color: "var(--text-subtle)", whiteSpace: "nowrap" }}>
                    {new Date(r.created_at).toLocaleDateString()} {new Date(r.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
