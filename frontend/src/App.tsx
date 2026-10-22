import './App.css'
import 'leaflet/dist/leaflet.css'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'

// ─── Fix Leaflet default icons ────────────────────────────────────────────────
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

// ─── Types ────────────────────────────────────────────────────────────────────
type Role       = 'officer' | 'work_team' | 'senior_officer'
type Status     = 'pending_officer_review' | 'approved' | 'rejected' | 'assigned' | 'in_progress' | 'resolved'
type Severity   = 'low' | 'medium' | 'high'
type DefectType = 'pothole' | 'garbage' | 'waterlogging'
type NavItem    = 'Overview' | 'Cameras' | 'Reports' | 'Teams' | 'Settings'
type DutyStatus = 'available' | 'on_duty' | 'offline'

interface Report {
  id: string; title: string; type: DefectType; severity: Severity; status: Status
  location: string; lat: number; lng: number; camera: string; team: string
  evidence: string; date: string; priority: string; summary: string
  assignedTo?: string; rejectionReason?: string; resolutionNotes?: string; resolutionPhoto?: string
}

interface Camera {
  id: string; name: string; address: string; lat: number; lng: number
  isActive: boolean; lastSeen: string; defectsDetected: number
}

interface TeamMember {
  id: string; name: string; team: string; email: string
  activeAssignments: number; resolved: number; status: DutyStatus
}

// ─── Reference data ───────────────────────────────────────────────────────────
const roleMeta: Record<Role, { label: string; accent: string; email: string; password: string; name: string }> = {
  officer:        { label: 'Officer',        accent: '#2563eb', email: 'officer@cityeye.ai', password: 'cityeye123', name: 'Aisha Khan'  },
  work_team:      { label: 'Work Team',      accent: '#14b8a6', email: 'team@cityeye.ai',    password: 'cityeye123', name: 'Ravi Menon'  },
  senior_officer: { label: 'Senior Officer', accent: '#f59e0b', email: 'senior@cityeye.ai',  password: 'cityeye123', name: 'Meera Patel' },
}

const statusLabel: Record<Status, string> = {
  pending_officer_review: 'Pending Review', approved: 'Approved', rejected: 'Rejected',
  assigned: 'Assigned', in_progress: 'In Progress', resolved: 'Resolved',
}

const statusColor: Record<Status, string> = {
  pending_officer_review: '#f59e0b', approved: '#2563eb', rejected: '#ef4444',
  assigned: '#8b5cf6', in_progress: '#f97316', resolved: '#22c55e',
}

const severityColor: Record<Severity, string> = { low: '#22c55e', medium: '#f59e0b', high: '#ef4444' }
const defectIcon:    Record<DefectType, string> = { pothole: '🕳️', garbage: '🗑️', waterlogging: '💧' }
const navIcons:      Record<NavItem, string>    = { Overview: '📊', Cameras: '📷', Reports: '📋', Teams: '👥', Settings: '⚙️' }

// ─── Stat cards ───────────────────────────────────────────────────────────────
const statCards = {
  officer:        [
    { label: 'Pending Review', value: '24', delta: '+6 today',       tone: 'warning' },
    { label: 'Approved',       value: '82', delta: '+12 this week',   tone: 'success' },
    { label: 'Assigned Crew',  value: '37', delta: '19 urgent',       tone: 'blue'    },
    { label: 'Resolved',       value: '164', delta: '94.2% SLA',      tone: 'neutral' },
  ],
  work_team:      [
    { label: 'Assigned to Me', value: '8',  delta: '3 urgent',        tone: 'warning' },
    { label: 'In Progress',    value: '4',  delta: '+2 today',         tone: 'success' },
    { label: 'This Week',      value: '12', delta: '6 resolved',       tone: 'blue'    },
    { label: 'SLA Breach',     value: '1',  delta: 'No critical risk', tone: 'neutral' },
  ],
  senior_officer: [
    { label: 'Open Reports',     value: '46', delta: '9 critical',       tone: 'warning' },
    { label: 'Severity High',    value: '14', delta: '+4 this week',      tone: 'success' },
    { label: 'Departments',      value: '7',  delta: 'all active',         tone: 'blue'    },
    { label: 'Resolution Rate',  value: '91%', delta: '3.4% vs target',   tone: 'neutral' },
  ],
} as const

// ─── Seed data ────────────────────────────────────────────────────────────────
const SEED_REPORTS: Report[] = [
  { id:'RPT-4021', title:'Pothole near Main Road Junction',     type:'pothole',      severity:'high',   status:'pending_officer_review', location:'Bhagwati Circle',   lat:22.7196, lng:75.8577, camera:'CAM-17A', team:'Road Maintenance Crew 2', evidence:'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80', date:'Today, 08:41 AM', priority:'Critical', summary:'Large pothole with broken asphalt and water accumulation creating a traffic hazard.' },
  { id:'RPT-4022', title:'Garbage accumulation at bus stop',    type:'garbage',      severity:'medium', status:'pending_officer_review', location:'Shivaji Nagar',      lat:22.7226, lng:75.8697, camera:'CAM-09C', team:'Sanitation Crew 1',       evidence:'https://images.unsplash.com/photo-1563453392212-326f5e854473?auto=format&fit=crop&w=900&q=80', date:'Today, 07:54 AM', priority:'High',     summary:'Waste pile detected adjacent to a public transit stop, with overflow near pedestrian footpath.' },
  { id:'RPT-3876', title:'Drain blockage in residential lane',  type:'waterlogging', severity:'high',   status:'assigned',               location:'Saket Residency',    lat:22.7156, lng:75.8627, camera:'CAM-31F', team:'Drainage Crew 2',         evidence:'https://images.unsplash.com/photo-1494526585095-c41746248156?auto=format&fit=crop&w=900&q=80', date:'Today, 09:12 AM', priority:'Urgent',   summary:'Heavy water accumulation on internal road caused by blocked drain near residential entry.', assignedTo:'Ravi Menon' },
  { id:'RPT-3872', title:'Pothole repair on Dholpur Road',      type:'pothole',      severity:'medium', status:'in_progress',            location:'Dholpur Road',       lat:22.7176, lng:75.8557, camera:'CAM-18G', team:'Road Maintenance Crew 2', evidence:'https://images.unsplash.com/photo-1559827260-dc66d52bef19?auto=format&fit=crop&w=900&q=80', date:'Today, 06:20 AM', priority:'High',     summary:'Repair in progress with patching underway and traffic management active.', assignedTo:'Ravi Menon' },
  { id:'RPT-3998', title:'Waterlogging on service lane',        type:'waterlogging', severity:'medium', status:'resolved',               location:'Kalyan Road',         lat:22.7246, lng:75.8507, camera:'CAM-22D', team:'Drainage Crew 3',         evidence:'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=900&q=80', date:'Yesterday, 05:36 PM', priority:'Medium', summary:'Resolved after de-silting operations and surface drainage restoration.', resolutionNotes:'Drain de-silted, surface water redirected. Area is now dry.' },
  { id:'RPT-3981', title:'Road crack near market gate',         type:'pothole',      severity:'low',    status:'approved',               location:'Market Gate',         lat:22.7206, lng:75.8647, camera:'CAM-04B', team:'Road Maintenance Crew 1', evidence:'https://images.unsplash.com/photo-1523217582562-09d0def993a6?auto=format&fit=crop&w=900&q=80', date:'Yesterday, 12:14 PM', priority:'Low', summary:'Approved for repair scheduling, pending assignment to a maintenance crew.' },
  { id:'RPT-3844', title:'Garbage pickup at Metro Station',     type:'garbage',      severity:'low',    status:'resolved',               location:'Metro Station East',  lat:22.7136, lng:75.8597, camera:'CAM-13E', team:'Sanitation Crew 1',       evidence:'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=900&q=80', date:'Yesterday, 04:18 PM', priority:'Medium', summary:'Garbage removed and area cleaned; completion photo attached.', resolutionNotes:'Area cleaned, bins replaced. No further action required.' },
]

const CAMERAS: Camera[] = [
  { id:'CAM-17A', name:'Bhagwati Circle Cam',     address:'Bhagwati Circle, Ring Road',        lat:22.7196, lng:75.8577, isActive:true,  lastSeen:'2 min ago',  defectsDetected:12 },
  { id:'CAM-09C', name:'Shivaji Nagar Bus Stop',  address:'Shivaji Nagar, Bus Stand',          lat:22.7226, lng:75.8697, isActive:true,  lastSeen:'1 min ago',  defectsDetected:7  },
  { id:'CAM-31F', name:'Saket Residency Gate',    address:'Saket Residency, Entry Gate',       lat:22.7156, lng:75.8627, isActive:true,  lastSeen:'5 min ago',  defectsDetected:3  },
  { id:'CAM-18G', name:'Dholpur Road Junction',   address:'Dholpur Road, Near Bridge',         lat:22.7176, lng:75.8557, isActive:false, lastSeen:'32 min ago', defectsDetected:9  },
  { id:'CAM-22D', name:'Kalyan Road Service Lane',address:'Kalyan Road, Service Lane Entry',   lat:22.7246, lng:75.8507, isActive:true,  lastSeen:'3 min ago',  defectsDetected:5  },
  { id:'CAM-04B', name:'Market Gate Camera',      address:'Market Gate, Main Entrance',        lat:22.7206, lng:75.8647, isActive:true,  lastSeen:'8 min ago',  defectsDetected:4  },
  { id:'CAM-13E', name:'Metro Station East',      address:'Metro Station, East Exit',          lat:22.7136, lng:75.8597, isActive:true,  lastSeen:'1 min ago',  defectsDetected:6  },
]

const TEAMS: TeamMember[] = [
  { id:'TM-01', name:'Ravi Menon',    team:'Drainage Crew 2',         email:'team@cityeye.ai',   activeAssignments:2, resolved:14, status:'on_duty'   },
  { id:'TM-02', name:'Priya Sharma',  team:'Road Maintenance Crew 1', email:'priya@cityeye.ai',  activeAssignments:1, resolved:22, status:'on_duty'   },
  { id:'TM-03', name:'Suresh Kumar',  team:'Road Maintenance Crew 2', email:'suresh@cityeye.ai', activeAssignments:3, resolved:18, status:'on_duty'   },
  { id:'TM-04', name:'Deepa Nair',    team:'Sanitation Crew 1',       email:'deepa@cityeye.ai',  activeAssignments:0, resolved:31, status:'available' },
  { id:'TM-05', name:'Amit Verma',    team:'Drainage Crew 3',         email:'amit@cityeye.ai',   activeAssignments:1, resolved:9,  status:'offline'   },
]

// ─── Map helpers ──────────────────────────────────────────────────────────────
function makeIcon(color: string) {
  return L.divIcon({
    html: `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
    className: '', iconSize: [16, 16], iconAnchor: [8, 8],
  })
}

function MapFly({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()
  useEffect(() => { map.flyTo([lat, lng], 15, { duration: 1 }) }, [lat, lng, map])
  return null
}

// ─── Modal ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

// ─── Settings Panel (self-contained with local state) ─────────────────────────
function SettingsPanel({ role, onSave }: { role: Role; onSave: () => void }) {
  const [notifDetections, setNotifDetections]   = useState(true)
  const [notifStatus,     setNotifStatus]        = useState(true)
  const [notifSLA,        setNotifSLA]           = useState(false)
  const [aiClahe,         setAiClahe]            = useState(true)
  const [aiTemporal,      setAiTemporal]         = useState(true)
  const [aiAutoReport,    setAiAutoReport]       = useState(true)
  const [confThresh,      setConfThresh]         = useState('0.65')
  const [frameThresh,     setFrameThresh]        = useState('5')

  return (
    <div className="settings-page">
      {/* Account */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-icon">👤</span>
          <div>
            <h3>Account</h3>
            <p>Your profile and role information</p>
          </div>
        </div>
        <div className="settings-fields">
          <div className="settings-field">
            <label className="sf-label">Full name</label>
            <input className="sf-input" readOnly value={roleMeta[role].name} />
          </div>
          <div className="settings-field">
            <label className="sf-label">Email address</label>
            <input className="sf-input" readOnly value={roleMeta[role].email} />
          </div>
          <div className="settings-field">
            <label className="sf-label">Role</label>
            <input className="sf-input" readOnly value={roleMeta[role].label} />
          </div>
          <div className="settings-field">
            <label className="sf-label">New password</label>
            <input className="sf-input" type="password" placeholder="Enter new password…" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-icon">🔔</span>
          <div>
            <h3>Notifications</h3>
            <p>Control what alerts you receive</p>
          </div>
        </div>
        <div className="settings-toggles">
          <ToggleRow label="New AI detections" desc="Alert when a new defect is confirmed by the AI" checked={notifDetections} onChange={setNotifDetections} />
          <ToggleRow label="Status updates"    desc="Alert when a report status changes"             checked={notifStatus}     onChange={setNotifStatus}     />
          <ToggleRow label="SLA breach alerts" desc="Alert when a report exceeds its SLA deadline"   checked={notifSLA}        onChange={setNotifSLA}        />
        </div>
      </div>

      {/* AI Detection */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-icon">🤖</span>
          <div>
            <h3>AI Detection</h3>
            <p>YOLOv8 inference and preprocessing settings</p>
          </div>
        </div>
        <div className="settings-toggles">
          <ToggleRow label="CLAHE low-light preprocessing" desc="Enhance dark/rainy frames before inference"  checked={aiClahe}      onChange={setAiClahe}      />
          <ToggleRow label="Temporal multi-frame verification" desc="Require defect confirmed across N consecutive frames" checked={aiTemporal} onChange={setAiTemporal} />
          <ToggleRow label="Auto-generate reports" desc="Automatically create a report when a defect is confirmed" checked={aiAutoReport} onChange={setAiAutoReport} />
        </div>
        <div className="settings-fields" style={{ marginTop: 16 }}>
          <div className="settings-field">
            <label className="sf-label">Confidence threshold (0–1)</label>
            <input className="sf-input" type="number" min="0" max="1" step="0.01" value={confThresh} onChange={e => setConfThresh(e.target.value)} />
          </div>
          <div className="settings-field">
            <label className="sf-label">Frame confirmation count</label>
            <input className="sf-input" type="number" min="1" max="20" value={frameThresh} onChange={e => setFrameThresh(e.target.value)} />
          </div>
        </div>
      </div>

      <button className="settings-save-btn" onClick={onSave}>
        💾 Save all settings
      </button>
    </div>
  )
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="toggle-row">
      <div className="toggle-text">
        <span className="toggle-label">{label}</span>
        <small className="toggle-desc">{desc}</small>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={`toggle-switch ${checked ? 'on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [selectedRole,  setSelectedRole]  = useState<Role>('officer')
  const [email,         setEmail]         = useState('officer@cityeye.ai')
  const [password,      setPassword]      = useState('cityeye123')
  const [isLoggedIn,    setIsLoggedIn]    = useState(false)
  const [dashboardRole, setDashboardRole] = useState<Role>('officer')
  const [activeNav,     setActiveNav]     = useState<NavItem>('Overview')
  const [loginError,    setLoginError]    = useState('')
  const [reports,       setReports]       = useState<Report[]>(SEED_REPORTS)
  const [flyTarget,     setFlyTarget]     = useState<{ lat: number; lng: number } | null>(null)

  // Modals
  const [detailModal,        setDetailModal]        = useState<Report | null>(null)
  const [rejectModal,        setRejectModal]        = useState<Report | null>(null)
  const [assignModal,        setAssignModal]        = useState<Report | null>(null)
  const [resolveModal,       setResolveModal]       = useState<Report | null>(null)
  const [rejectReason,       setRejectReason]       = useState('')
  const [assignTeam,         setAssignTeam]         = useState('')
  const [resolveNotes,       setResolveNotes]       = useState('')
  const [resolvePhoto,       setResolvePhoto]       = useState('')
  const [userProfileOpen,    setUserProfileOpen]    = useState(false)
  // Team modals
  const [profileModal,       setProfileModal]       = useState<TeamMember | null>(null)
  const [teamAssignModal,    setTeamAssignModal]    = useState<TeamMember | null>(null)
  const [teamAssignReportId, setTeamAssignReportId] = useState('')

  // Filters
  const [filterStatus,   setFilterStatus]   = useState<Status | 'all'>('all')
  const [filterType,     setFilterType]     = useState<DefectType | 'all'>('all')
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'all'>('all')

  // Toast
  const [toast, setToast] = useState<string | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3200)
  }, [])

  // ── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    const cfg = roleMeta[selectedRole]
    if (email.trim().toLowerCase() !== cfg.email || password !== cfg.password) {
      setLoginError('Incorrect email or password for the selected role.')
      return
    }
    setDashboardRole(selectedRole)
    setLoginError('')
    setIsLoggedIn(true)
  }

  // ── Report actions ───────────────────────────────────────────────────────────
  const approveReport = (id: string) => {
    setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'approved' } : r))
    showToast(`✅ Report ${id} approved`)
  }
  const rejectReport = (id: string, reason: string) => {
    if (!reason.trim()) { showToast('⚠️ Please enter a rejection reason'); return }
    setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'rejected', rejectionReason: reason } : r))
    setRejectModal(null); setRejectReason('')
    showToast(`❌ Report ${id} rejected`)
  }
  const assignReport = (id: string, member: string) => {
    if (!member) { showToast('⚠️ Please select a team member'); return }
    setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'assigned', assignedTo: member } : r))
    setAssignModal(null); setAssignTeam('')
    showToast(`👷 ${id} assigned to ${member}`)
  }
  const startWork = (id: string) => {
    setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'in_progress' } : r))
    showToast(`🔧 Work started on ${id}`)
  }
  const resolveReport = (id: string, notes: string) => {
    if (!notes.trim()) { showToast('⚠️ Please enter resolution notes'); return }
    setReports(rs => rs.map(r => r.id === id ? { ...r, status: 'resolved', resolutionNotes: notes } : r))
    setResolveModal(null); setResolveNotes('')
    showToast(`🏁 Report ${id} marked resolved`)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const myReports = useMemo(() => {
    if (dashboardRole === 'work_team')
      return reports.filter(r => r.assignedTo === roleMeta.work_team.name)
    return reports
  }, [reports, dashboardRole])

  const overviewQueue = useMemo(() => {
    if (dashboardRole === 'officer')
      return reports.filter(r => r.status === 'pending_officer_review').slice(0, 5)
    if (dashboardRole === 'work_team')
      return reports.filter(r => ['assigned','in_progress'].includes(r.status) && r.assignedTo === roleMeta.work_team.name).slice(0, 5)
    return reports.filter(r => r.status !== 'resolved').slice(0, 5)
  }, [reports, dashboardRole])

  const filteredReports = useMemo(() =>
    myReports.filter(r =>
      (filterStatus   === 'all' || r.status   === filterStatus)   &&
      (filterType     === 'all' || r.type     === filterType)     &&
      (filterSeverity === 'all' || r.severity === filterSeverity)
    ), [myReports, filterStatus, filterType, filterSeverity])

  // ─── LOGIN PAGE ──────────────────────────────────────────────────────────────
  if (!isLoggedIn) return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-branding">
          <div className="brand-lockup">
            <div className="mini-mark">C</div>
            <div><div className="brand-name">CityEye</div><div className="brand-tag">Smart city monitoring</div></div>
          </div>
          <div className="hero-copy">
            <span className="eyebrow light">Infrastructure intelligence</span>
            <h1>Monitor municipal issues with live visibility.</h1>
            <p>Detect road defects, sanitation hazards, and drainage problems across your city with AI-powered review and role-based operations.</p>
          </div>
          <div className="role-cards">
            {(['officer','work_team','senior_officer'] as Role[]).map(r => (
              <button key={r} type="button"
                className={selectedRole === r ? 'role-choice selected' : 'role-choice'}
                onClick={() => { setSelectedRole(r); setEmail(roleMeta[r].email); setPassword(roleMeta[r].password); setLoginError('') }}>
                <span className="role-dot" style={{ background: roleMeta[r].accent }} />
                <span>{roleMeta[r].label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="login-form-wrap">
          <div className="login-header">
            <span className="eyebrow dark">Welcome back</span>
            <h2>Sign in</h2>
          </div>
          <form className="login-form" onSubmit={handleLogin}>
            <label><span>Email</span>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@cityeye.ai" />
            </label>
            <label><span>Password</span>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
            </label>
            <div className="login-options">
              <label className="remember-me"><input type="checkbox" defaultChecked /><span>Remember me</span></label>
              <button type="button" className="link-button">Forgot password?</button>
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="submit-button">Sign in as {roleMeta[selectedRole].label}</button>
            <div className="demo-box">
              <span>Demo credentials</span>
              <strong>{roleMeta[selectedRole].email}</strong>
              <small>Password: {roleMeta[selectedRole].password}</small>
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  // ─── DASHBOARD ──────────────────────────────────────────────────────────────
  return (
    <div className="app-shell">

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="brand-wrap">
          <div className="brand-mark">C</div>
          <div><div className="brand-name">CityEye</div><div className="brand-subtitle">Municipal command</div></div>
        </div>

        <nav className="nav">
          {(['Overview','Cameras','Reports','Teams','Settings'] as NavItem[]).map(item => (
            <button key={item} type="button"
              className={activeNav === item ? 'nav-item active' : 'nav-item'}
              onClick={() => setActiveNav(item)}>
              <span className="nav-icon">{navIcons[item]}</span>{item}
            </button>
          ))}
        </nav>

        <div className="role-panel">
          <div className="section-label">Logged in as</div>
          <div className="logged-in-user" style={{cursor:'pointer'}} onClick={() => setUserProfileOpen(true)} title="Click to view profile">
            <div className="avatar-sm" style={{ background: roleMeta[dashboardRole].accent }}>
              {roleMeta[dashboardRole].name.split(' ').map(p => p[0]).join('')}
            </div>
            <div>
              <span className="user-name">{roleMeta[dashboardRole].name}</span>
              <span className="user-role">{roleMeta[dashboardRole].label}</span>
            </div>
            <span style={{marginLeft:'auto',color:'#64748b',fontSize:'.7rem'}}>›</span>
          </div>
          <button className="logout-btn" onClick={() => { setIsLoggedIn(false); setLoginError('') }}>Sign out</button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="main-panel">

        {/* Topbar */}
        <header className="topbar">
          <div>
            <p className="eyebrow-small">Municipal monitoring</p>
            <h1>{activeNav}</h1>
          </div>
          <div className="user-pill">
            <div className="avatar">{roleMeta[dashboardRole].name.split(' ').map(p => p[0]).join('')}</div>
            <div><strong>{roleMeta[dashboardRole].name}</strong><small>{roleMeta[dashboardRole].label}</small></div>
          </div>
        </header>

        {/* ══ OVERVIEW ══ */}
        {activeNav === 'Overview' && (<>
          <section className="stats-grid">
            {statCards[dashboardRole].map(c => (
              <div key={c.label} className={`stat-card ${c.tone}`}>
                <span>{c.label}</span><strong>{c.value}</strong><small>{c.delta}</small>
              </div>
            ))}
          </section>
          <section className="content-grid">
            {/* Map */}
            <div className="card map-card">
              <div className="card-header">
                <h2>City operations map</h2><span className="chip success">Live</span>
              </div>
              <div className="leaflet-wrap">
                <MapContainer center={[22.7196,75.8577]} zoom={14} style={{ height:'100%',width:'100%',borderRadius:'14px' }} scrollWheelZoom>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  {flyTarget && <MapFly lat={flyTarget.lat} lng={flyTarget.lng} />}
                  {reports.map(r => (
                    <Marker key={r.id} position={[r.lat,r.lng]} icon={makeIcon(statusColor[r.status])}>
                      <Popup><div style={{minWidth:180}}>
                        <strong>{r.id}</strong><br/>
                        {defectIcon[r.type]} {r.title}<br/>
                        <span style={{color:statusColor[r.status],fontWeight:700}}>{statusLabel[r.status]}</span><br/>
                        <small>{r.location}</small>
                      </div></Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
              <div className="map-legend">
                {(Object.entries(statusColor) as [Status,string][]).map(([s,c]) => (
                  <span key={s} className="legend-item"><span className="legend-dot" style={{background:c}}/>{statusLabel[s]}</span>
                ))}
              </div>
            </div>

            {/* Priority queue */}
            <div className="card issue-card">
              <div className="card-header">
                <h2>Priority queue</h2><span className="chip neutral">{overviewQueue.length} open</span>
              </div>
              <div className="issue-list">
                {overviewQueue.length === 0 && <div className="empty-state">No active items</div>}
                {overviewQueue.map(item => (
                  <div key={item.id} className="issue-item clickable"
                    onClick={() => { setFlyTarget({lat:item.lat,lng:item.lng}); setDetailModal(item) }}>
                    <div className="issue-thumb" style={{backgroundImage:`url(${item.evidence})`}}/>
                    <div className="issue-copy">
                      <div className="issue-line">
                        <strong>{item.title}</strong>
                        <span className="severity" style={{color:severityColor[item.severity]}}>{item.severity}</span>
                      </div>
                      <div className="meta-line">{item.location} · {item.camera}</div>
                      <div className="meta-line">{item.date}</div>
                      <span className="status-chip" style={{background:`${statusColor[item.status]}22`,color:statusColor[item.status]}}>{statusLabel[item.status]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </>)}

        {/* ══ CAMERAS ══ */}
        {activeNav === 'Cameras' && (
          <section className="content-grid" style={{gridTemplateColumns:'1.4fr 1fr'}}>
            <div className="card map-card">
              <div className="card-header">
                <h2>Camera locations</h2>
                <span className="chip success">{CAMERAS.filter(c=>c.isActive).length} online</span>
              </div>
              <div className="leaflet-wrap">
                <MapContainer center={[22.7196,75.8577]} zoom={14} style={{height:'100%',width:'100%',borderRadius:'14px'}} scrollWheelZoom>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                  {flyTarget && <MapFly lat={flyTarget.lat} lng={flyTarget.lng}/>}
                  {CAMERAS.map(cam => (
                    <Marker key={cam.id} position={[cam.lat,cam.lng]} icon={makeIcon(cam.isActive?'#22c55e':'#94a3b8')}>
                      <Popup>
                        <strong>{cam.name}</strong><br/>{cam.address}<br/>
                        <span style={{color:cam.isActive?'#22c55e':'#94a3b8',fontWeight:700}}>{cam.isActive?'🟢 Online':'⚫ Offline'}</span><br/>
                        <small>Last seen: {cam.lastSeen} · {cam.defectsDetected} defects</small>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            </div>
            <div className="card" style={{overflowY:'auto'}}>
              <div className="card-header"><h2>All cameras</h2><span className="chip neutral">{CAMERAS.length} total</span></div>
              <div className="camera-list">
                {CAMERAS.map(cam => (
                  <div key={cam.id} className="camera-row" onClick={() => setFlyTarget({lat:cam.lat,lng:cam.lng})}>
                    <div className="cam-status-dot" style={{background:cam.isActive?'#22c55e':'#94a3b8'}}/>
                    <div className="cam-info">
                      <strong>{cam.name}</strong>
                      <small>{cam.id} · {cam.address}</small>
                      <small>Last seen: {cam.lastSeen} · {cam.defectsDetected} defects detected</small>
                    </div>
                    <span className="cam-badge" style={{background:cam.isActive?'#dcfce7':'#f1f5f9',color:cam.isActive?'#15803d':'#64748b'}}>
                      {cam.isActive?'Online':'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ══ REPORTS ══ */}
        {activeNav === 'Reports' && (
          <section className="reports-panel card">
            <div className="card-header">
              <h2>
                {dashboardRole==='officer' && 'Review queue'}
                {dashboardRole==='work_team' && 'My assigned repairs'}
                {dashboardRole==='senior_officer' && 'All reports — read-only'}
              </h2>
              <span className="chip neutral">{filteredReports.length} reports</span>
            </div>
            {/* Filters */}
            <div className="filter-bar">
              <select className="filter-select" value={filterStatus} onChange={e=>setFilterStatus(e.target.value as any)}>
                <option value="all">All statuses</option>
                {(Object.entries(statusLabel) as [Status,string][]).map(([v,l])=><option key={v} value={v}>{l}</option>)}
              </select>
              <select className="filter-select" value={filterType} onChange={e=>setFilterType(e.target.value as any)}>
                <option value="all">All types</option>
                <option value="pothole">🕳️ Pothole</option>
                <option value="garbage">🗑️ Garbage</option>
                <option value="waterlogging">💧 Waterlogging</option>
              </select>
              <select className="filter-select" value={filterSeverity} onChange={e=>setFilterSeverity(e.target.value as any)}>
                <option value="all">All severities</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
              <span className="filter-count">{filteredReports.length} result{filteredReports.length!==1?'s':''}</span>
            </div>

            <div className="report-table">
              <div className="report-row header-row">
                <span>Report</span><span>Type</span><span>Status</span><span>Severity</span><span>Actions</span>
              </div>
              {filteredReports.length===0 && <div className="empty-state">No reports match these filters</div>}
              {filteredReports.map(r => (
                <div key={r.id} className="report-row">
                  <div className="report-main">
                    <div className="mini-thumb" style={{backgroundImage:`url(${r.evidence})`}}/>
                    <div>
                      <strong>{r.id}</strong>
                      <small>{r.title}</small>
                      <small style={{color:'#94a3b8'}}>{r.location}</small>
                    </div>
                  </div>
                  <span>{defectIcon[r.type]} {r.type}</span>
                  <span className="status-badge" style={{background:`${statusColor[r.status]}22`,color:statusColor[r.status]}}>{statusLabel[r.status]}</span>
                  <span className="severity-pill" style={{background:`${severityColor[r.severity]}22`,color:severityColor[r.severity]}}>{r.severity}</span>
                  <div className="row-actions">
                    <button className="view-btn" onClick={()=>setDetailModal(r)}>View</button>
                    {dashboardRole==='officer' && r.status==='pending_officer_review' && <>
                      <button className="ghost-button" onClick={()=>approveReport(r.id)}>Approve</button>
                      <button className="text-button"  onClick={()=>{setRejectModal(r);setRejectReason('')}}>Reject</button>
                    </>}
                    {dashboardRole==='officer' && r.status==='approved' &&
                      <button className="assign-btn" onClick={()=>{setAssignModal(r);setAssignTeam('')}}>Assign</button>}
                    {dashboardRole==='work_team' && r.status==='assigned' && r.assignedTo===roleMeta.work_team.name &&
                      <button className="start-btn" onClick={()=>startWork(r.id)}>Start Work</button>}
                    {dashboardRole==='work_team' && r.status==='in_progress' && r.assignedTo===roleMeta.work_team.name &&
                      <button className="resolve-btn" onClick={()=>{setResolveModal(r);setResolveNotes('')}}>Mark Resolved</button>}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ══ TEAMS ══ */}
        {activeNav === 'Teams' && (
          <div className="teams-page">
            {/* Summary row */}
            <div className="teams-stats-row">
              {[
                { label:'Total Members',  value:TEAMS.length,                                               color:'#0f172a' },
                { label:'On Duty',        value:TEAMS.filter(t=>t.status==='on_duty').length,               color:'#15803d' },
                { label:'Available',      value:TEAMS.filter(t=>t.status==='available').length,             color:'#1d4ed8' },
                { label:'Offline',        value:TEAMS.filter(t=>t.status==='offline').length,               color:'#94a3b8' },
                { label:'Active Jobs',    value:TEAMS.reduce((a,t)=>a+t.activeAssignments,0),               color:'#d97706' },
                { label:'Total Resolved', value:TEAMS.reduce((a,t)=>a+t.resolved,0),                        color:'#22c55e' },
              ].map(s => (
                <div key={s.label} className="team-stat-card">
                  <span className="tsc-value" style={{color:s.color}}>{s.value}</span>
                  <span className="tsc-label">{s.label}</span>
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="card">
              <div className="card-header">
                <h2>Field team members</h2>
                <span className="chip neutral">{TEAMS.length} members</span>
              </div>
              <div className="team-table">
                <div className="team-row team-header-row">
                  <span>Member</span>
                  <span>Team / Department</span>
                  <span>Active Jobs</span>
                  <span>Resolved</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                {TEAMS.map(m => {
                  const dutyColor = m.status==='on_duty' ? '#22c55e' : m.status==='available' ? '#2563eb' : '#94a3b8'
                  const bgColor   = m.status==='on_duty' ? '#dcfce7'  : m.status==='available' ? '#dbeafe'  : '#f1f5f9'
                  const txtColor  = m.status==='on_duty' ? '#15803d'  : m.status==='available' ? '#1d4ed8'  : '#64748b'
                  const dutyLabel = m.status==='on_duty' ? 'On Duty'  : m.status==='available' ? 'Available': 'Offline'
                  return (
                    <div key={m.id} className="team-row">
                      {/* Member cell */}
                      <div className="tm-member">
                        <div className="tm-avatar" style={{background: m.status==='offline' ? '#94a3b8' : `linear-gradient(135deg,#14b8a6,#2563eb)`}}>
                          {m.name.split(' ').map(p=>p[0]).join('')}
                        </div>
                        <div>
                          <span className="tm-name">{m.name}</span>
                          <small className="tm-email">{m.email}</small>
                        </div>
                      </div>
                      {/* Department */}
                      <span className="tm-dept">{m.team}</span>
                      {/* Active */}
                      <span className="tm-num">
                        <span className="num-pill" style={{background:m.activeAssignments>0?'#fef3c7':'#f1f5f9',color:m.activeAssignments>0?'#92400e':'#94a3b8'}}>
                          {m.activeAssignments}
                        </span>
                      </span>
                      {/* Resolved */}
                      <span className="tm-num">
                        <span className="num-pill" style={{background:'#dcfce7',color:'#15803d'}}>{m.resolved}</span>
                      </span>
                      {/* Status */}
                      <span className="tm-status-badge" style={{background:bgColor,color:txtColor}}>
                        <span className="duty-dot" style={{background:dutyColor}}/>
                        {dutyLabel}
                      </span>
                      {/* Actions */}
                      <div className="tm-actions">
                        <button className="view-btn" onClick={() => setProfileModal(m)}>Profile</button>
                        {dashboardRole === 'officer' && m.status !== 'offline' && (
                          <button className="ghost-button" onClick={() => { setTeamAssignModal(m); setTeamAssignReportId('') }}>Assign</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ SETTINGS ══ */}
        {activeNav === 'Settings' && (
          <SettingsPanel role={dashboardRole} onSave={() => showToast('✅ Settings saved successfully')} />
        )}

      </main>

      {/* ── MODALS ── */}
      {detailModal && (
        <Modal title={`📋 Full Report — ${detailModal.id}`} onClose={()=>setDetailModal(null)}>
          {/* Main evidence photo */}
          <img src={detailModal.evidence} alt="Main evidence" className="rv-main-img" />

          {/* Multi-angle gallery */}
          <div className="rv-gallery">
            <div className="rv-gallery-item">
              <img src={detailModal.evidence} alt="Front view" />
              <span className="rv-gallery-label">📷 Front View</span>
            </div>
            <div className="rv-gallery-item">
              <img src={detailModal.evidence} alt="Side view" style={{filter:'brightness(0.72) contrast(1.25)'}} />
              <span className="rv-gallery-label">🌙 Night Capture</span>
            </div>
            <div className="rv-gallery-item">
              <img src={detailModal.evidence} alt="Thermal view" style={{filter:'saturate(0) brightness(1.15) sepia(0.4)'}} />
              <span className="rv-gallery-label">🔭 Enhanced View</span>
            </div>
          </div>

          {/* Status + severity badges */}
          <div className="rv-badges">
            <span className="rv-badge" style={{background:`${statusColor[detailModal.status]}18`, color:statusColor[detailModal.status], border:`1px solid ${statusColor[detailModal.status]}44`}}>
              {statusLabel[detailModal.status]}
            </span>
            <span className="rv-badge" style={{background:`${severityColor[detailModal.severity]}18`, color:severityColor[detailModal.severity], border:`1px solid ${severityColor[detailModal.severity]}44`}}>
              {detailModal.severity.toUpperCase()} SEVERITY
            </span>
            <span className="rv-badge" style={{background:'rgba(148,163,184,.12)', color:'#475569', border:'1px solid rgba(148,163,184,.2)'}}>
              {defectIcon[detailModal.type]} {detailModal.type}
            </span>
          </div>

          {/* Info grid */}
          <div className="rv-info-grid">
            <div><span className="rv-label">Report ID</span><strong>{detailModal.id}</strong></div>
            <div><span className="rv-label">Date Detected</span><strong>{detailModal.date}</strong></div>
            <div><span className="rv-label">Location</span><strong>{detailModal.location}</strong></div>
            <div><span className="rv-label">Camera</span><strong>{detailModal.camera}</strong></div>
            <div><span className="rv-label">Priority</span><strong style={{color: detailModal.priority==='Critical'?'#ef4444': detailModal.priority==='High'||detailModal.priority==='Urgent'?'#f97316':'#64748b'}}>{detailModal.priority}</strong></div>
            <div><span className="rv-label">Assigned To</span><strong>{detailModal.assignedTo || '—'}</strong></div>
          </div>

          {/* AI Summary */}
          <div className="rv-summary-box">
            <span className="rv-label">🤖 AI Generated Summary</span>
            <p>{detailModal.summary}</p>
          </div>

          {/* Rejection reason */}
          {detailModal.rejectionReason && (
            <div className="rv-rejection-box">
              <span className="rv-label">❌ Rejection Reason</span>
              <p>{detailModal.rejectionReason}</p>
            </div>
          )}

          {/* Resolution */}
          {detailModal.resolutionNotes && (
            <div className="rv-resolved-box">
              <span className="rv-label">✅ Resolution Notes</span>
              <p>{detailModal.resolutionNotes}</p>
              {detailModal.resolutionPhoto && (
                <img src={detailModal.resolutionPhoto} alt="Proof of resolution" className="rv-proof-img" />
              )}
            </div>
          )}
        </Modal>
      )}

      {rejectModal && (
        <Modal title={`Reject ${rejectModal.id}`} onClose={()=>setRejectModal(null)}>
          <p style={{color:'#475569',marginBottom:12}}>Provide a reason for rejection. This will be recorded permanently.</p>
          <textarea className="modal-textarea" rows={4} value={rejectReason}
            onChange={e=>setRejectReason(e.target.value)} placeholder="Enter rejection reason…"/>
          <div className="modal-actions">
            <button className="view-btn" onClick={()=>setRejectModal(null)}>Cancel</button>
            <button style={{background:'#fee2e2',color:'#b91c1c',border:'none',borderRadius:8,padding:'8px 14px',fontWeight:700,cursor:'pointer'}}
              onClick={()=>rejectReport(rejectModal.id, rejectReason)}>Confirm Rejection</button>
          </div>
        </Modal>
      )}

      {assignModal && (
        <Modal title={`Assign ${assignModal.id}`} onClose={()=>setAssignModal(null)}>
          <p style={{color:'#475569',marginBottom:12}}>Select a team member to assign this report:</p>
          <select className="filter-select" style={{width:'100%',marginBottom:16}} value={assignTeam} onChange={e=>setAssignTeam(e.target.value)}>
            <option value="">— Select team member —</option>
            {TEAMS.filter(t=>t.status!=='offline').map(t=>(
              <option key={t.id} value={t.name}>{t.name} ({t.team}) — {t.activeAssignments} active</option>
            ))}
          </select>
          <div className="modal-actions">
            <button className="view-btn" onClick={()=>setAssignModal(null)}>Cancel</button>
            <button className="primary-action small" onClick={()=>assignReport(assignModal.id, assignTeam)}>Assign</button>
          </div>
        </Modal>
      )}

      {resolveModal && (
        <Modal title={`✅ Mark Resolved — ${resolveModal.id}`} onClose={()=>{setResolveModal(null);setResolvePhoto('')}}>
          {/* Photo upload */}
          <p style={{color:'#475569',fontSize:'.88rem',marginBottom:10}}>Upload a proof photo of the completed work:</p>
          {resolvePhoto
            ? <div style={{position:'relative',marginBottom:12}}>
                <img src={resolvePhoto} alt="Proof preview" className="upload-preview" />
                <button onClick={()=>setResolvePhoto('')} style={{position:'absolute',top:6,right:6,background:'rgba(15,23,42,.6)',color:'white',border:'none',borderRadius:999,width:26,height:26,cursor:'pointer',fontSize:'.75rem'}}>✕</button>
              </div>
            : <label className="upload-zone">
                <span className="upload-zone-icon">📷</span>
                <p>Click to upload proof photo</p>
                <small style={{color:'#94a3b8',fontSize:'.72rem'}}>JPG, PNG or HEIC — taken on site</small>
                <input type="file" accept="image/*" style={{display:'none'}}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) setResolvePhoto(URL.createObjectURL(f))
                  }} />
              </label>
          }
          {/* Notes */}
          <p style={{color:'#475569',fontSize:'.88rem',marginBottom:8}}>Describe the work done:</p>
          <textarea className="modal-textarea" rows={4} value={resolveNotes}
            onChange={e=>setResolveNotes(e.target.value)} placeholder="e.g. Pothole filled with asphalt, area barricaded and repainted…"/>
          <div className="modal-actions">
            <button className="view-btn" onClick={()=>{setResolveModal(null);setResolvePhoto('')}}>Cancel</button>
            <button className="resolve-btn" style={{padding:'8px 16px',fontSize:'.85rem'}}
              onClick={()=>{
                if (!resolveNotes.trim()){showToast('⚠️ Please describe the work done');return}
                setReports(rs=>rs.map(r=>r.id===resolveModal.id?{...r,status:'resolved',resolutionNotes:resolveNotes,resolutionPhoto:resolvePhoto}:r))
                setResolveModal(null);setResolveNotes('');setResolvePhoto('')
                showToast(`🏁 ${resolveModal.id} marked resolved`)
              }}>
              ✅ Mark Resolved
            </button>
          </div>
        </Modal>
      )}

      {/* ── PROFILE MODAL ── */}
      {profileModal && (() => {
        const m = profileModal
        const memberReports = reports.filter(r => r.assignedTo === m.name)
        const active   = memberReports.filter(r => ['assigned','in_progress'].includes(r.status))
        const done     = memberReports.filter(r => r.status === 'resolved')
        const dutyColor = m.status === 'on_duty' ? '#22c55e' : m.status === 'available' ? '#2563eb' : '#94a3b8'
        const bgColor   = m.status === 'on_duty' ? '#dcfce7'  : m.status === 'available' ? '#dbeafe'  : '#f1f5f9'
        const txtColor  = m.status === 'on_duty' ? '#15803d'  : m.status === 'available' ? '#1d4ed8'  : '#64748b'
        const dutyLabel = m.status === 'on_duty' ? 'On Duty'  : m.status === 'available' ? 'Available' : 'Offline'
        return (
          <Modal title="Team Member Profile" onClose={() => setProfileModal(null)}>
            {/* Header */}
            <div className="prof-header">
              <div className="prof-avatar" style={{ background: m.status === 'offline' ? '#94a3b8' : 'linear-gradient(135deg,#14b8a6,#2563eb)' }}>
                {m.name.split(' ').map(p => p[0]).join('')}
              </div>
              <div className="prof-info">
                <h3>{m.name}</h3>
                <p>{m.team}</p>
                <a href={`mailto:${m.email}`}>{m.email}</a>
                <span className="prof-status" style={{ background: bgColor, color: txtColor }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: dutyColor, display: 'inline-block', marginRight: 6 }} />
                  {dutyLabel}
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="prof-stats">
              <div className="prof-stat"><span>{m.activeAssignments}</span><small>Active Jobs</small></div>
              <div className="prof-stat"><span>{m.resolved}</span><small>Total Resolved</small></div>
              <div className="prof-stat"><span>{done.length}</span><small>Resolved (this session)</small></div>
              <div className="prof-stat"><span>{active.length > 0 ? Math.round((done.length / (done.length + active.length)) * 100) : 100}%</span><small>Completion Rate</small></div>
            </div>

            {/* Active assignments */}
            <div className="prof-section-title">Active Assignments ({active.length})</div>
            {active.length === 0
              ? <p className="prof-empty">No active assignments right now.</p>
              : active.map(r => (
                <div key={r.id} className="prof-report-row">
                  <div className="mini-thumb" style={{ backgroundImage: `url(${r.evidence})` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{r.id}</strong>
                    <small style={{ display: 'block', color: '#475569' }}>{r.title}</small>
                    <small style={{ color: '#94a3b8' }}>{r.location} · {r.date}</small>
                  </div>
                  <span className="severity-pill" style={{ background: `${severityColor[r.severity]}22`, color: severityColor[r.severity] }}>{r.severity}</span>
                  <span className="status-badge" style={{ background: `${statusColor[r.status]}22`, color: statusColor[r.status] }}>{statusLabel[r.status]}</span>
                </div>
              ))
            }

            {/* Resolved */}
            {done.length > 0 && <>
              <div className="prof-section-title" style={{ marginTop: 16 }}>Recently Resolved ({done.length})</div>
              {done.map(r => (
                <div key={r.id} className="prof-report-row" style={{ opacity: 0.7 }}>
                  <div className="mini-thumb" style={{ backgroundImage: `url(${r.evidence})` }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>{r.id}</strong>
                    <small style={{ display: 'block', color: '#475569' }}>{r.title}</small>
                    <small style={{ color: '#94a3b8' }}>{r.location}</small>
                  </div>
                  <span className="status-badge" style={{ background: '#dcfce7', color: '#15803d' }}>Resolved</span>
                </div>
              ))}
            </>}
          </Modal>
        )
      })()}

      {/* ── TEAM ASSIGN MODAL ── */}
      {teamAssignModal && (() => {
        const m = teamAssignModal
        const available = reports.filter(r => r.status === 'approved')
        return (
          <Modal title={`Assign a Report to ${m.name}`} onClose={() => setTeamAssignModal(null)}>
            <div className="prof-header" style={{ marginBottom: 16 }}>
              <div className="prof-avatar" style={{ width: 44, height: 44, fontSize: '.8rem', background: 'linear-gradient(135deg,#14b8a6,#2563eb)' }}>
                {m.name.split(' ').map(p => p[0]).join('')}
              </div>
              <div className="prof-info">
                <h3 style={{ fontSize: '1rem' }}>{m.name}</h3>
                <p>{m.team} · {m.activeAssignments} active job{m.activeAssignments !== 1 ? 's' : ''}</p>
              </div>
            </div>

            {available.length === 0
              ? <div className="prof-empty">No approved reports are available to assign right now. Approve a report from the Reports tab first.</div>
              : <>
                  <p style={{ color: '#475569', fontSize: '.88rem', marginBottom: 12 }}>
                    Select an approved report to assign to this team member:
                  </p>
                  <div className="team-assign-list">
                    {available.map(r => (
                      <label key={r.id} className={`team-assign-row ${teamAssignReportId === r.id ? 'selected' : ''}`}>
                        <input type="radio" name="assign-report" value={r.id}
                          checked={teamAssignReportId === r.id}
                          onChange={() => setTeamAssignReportId(r.id)} />
                        <div className="mini-thumb" style={{ backgroundImage: `url(${r.evidence})` }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <strong>{r.id} — {r.title}</strong>
                          <small style={{ display: 'block', color: '#64748b' }}>{r.location} · {r.camera}</small>
                        </div>
                        <span className="severity-pill" style={{ background: `${severityColor[r.severity]}22`, color: severityColor[r.severity] }}>{r.severity}</span>
                      </label>
                    ))}
                  </div>
                  <div className="modal-actions">
                    <button className="view-btn" onClick={() => setTeamAssignModal(null)}>Cancel</button>
                    <button className="assign-btn" onClick={() => {
                      if (!teamAssignReportId) { showToast('⚠️ Please select a report first'); return }
                      setReports(rs => rs.map(r => r.id === teamAssignReportId ? { ...r, status: 'assigned', assignedTo: m.name } : r))
                      setTeamAssignModal(null)
                      setTeamAssignReportId('')
                      showToast(`✅ Report assigned to ${m.name}`)
                    }}>
                      Assign to {m.name}
                    </button>
                  </div>
                </>
            }
          </Modal>
        )
      })()}

      {toast && <div className="toast">{toast}</div>}

      {/* ── USER PROFILE MODAL ── */}
      {userProfileOpen && (
        <Modal title="My Profile" onClose={() => setUserProfileOpen(false)}>
          <div className="my-profile-modal">
            {/* Avatar */}
            <div className="my-prof-avatar" style={{ background: roleMeta[dashboardRole].accent }}>
              {roleMeta[dashboardRole].name.split(' ').map(p => p[0]).join('')}
            </div>
            <h2 className="my-prof-name">{roleMeta[dashboardRole].name}</h2>
            <span className="my-prof-role-badge" style={{ background: `${roleMeta[dashboardRole].accent}22`, color: roleMeta[dashboardRole].accent }}>
              {roleMeta[dashboardRole].label}
            </span>

            {/* Details grid */}
            <div className="my-prof-grid">
              <div><span className="rv-label">Email</span><strong>{roleMeta[dashboardRole].email}</strong></div>
              <div><span className="rv-label">Department</span><strong>Municipal Corporation</strong></div>
              <div><span className="rv-label">Employee ID</span><strong>{dashboardRole==='officer'?'OFF-2024-001':dashboardRole==='work_team'?'WRK-2024-042':'SNR-2024-007'}</strong></div>
              <div><span className="rv-label">Member Since</span><strong>January 2024</strong></div>
              <div><span className="rv-label">Zone</span><strong>Zone B — Central District</strong></div>
              <div><span className="rv-label">Reports Handled</span><strong>{dashboardRole==='officer'?'164 total':dashboardRole==='work_team'?'14 resolved':'All (read-only)'}</strong></div>
            </div>

            {/* Permissions */}
            <div className="my-prof-perms">
              <span className="rv-label" style={{display:'block',marginBottom:10}}>Role Permissions</span>
              <ul>
                {dashboardRole === 'officer' && <>
                  <li>✅ Approve or reject incoming reports</li>
                  <li>✅ Assign reports to field teams</li>
                  <li>✅ View all reports, cameras and teams</li>
                  <li>❌ Cannot mark reports as resolved</li>
                </>}
                {dashboardRole === 'work_team' && <>
                  <li>✅ View reports assigned to you</li>
                  <li>✅ Start work on assigned reports</li>
                  <li>✅ Mark reports resolved with proof photo</li>
                  <li>❌ Cannot approve, reject or assign reports</li>
                </>}
                {dashboardRole === 'senior_officer' && <>
                  <li>✅ Read-only view of all reports</li>
                  <li>✅ View full system statistics and maps</li>
                  <li>✅ View all cameras and team members</li>
                  <li>❌ Cannot approve, reject, assign or resolve</li>
                </>}
              </ul>
            </div>

            <div className="modal-actions" style={{width:'100%',marginTop:16}}>
              <button className="view-btn" onClick={() => setUserProfileOpen(false)}>Close</button>
              <button className="logout-btn" style={{flex:'none',width:'auto',padding:'8px 16px'}}
                onClick={() => { setUserProfileOpen(false); setIsLoggedIn(false) }}>
                Sign out
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
