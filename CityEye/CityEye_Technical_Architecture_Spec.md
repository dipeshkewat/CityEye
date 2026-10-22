# Technical Architecture & Build Specification (v2)
## CityEye — Municipal Infrastructure Monitoring System

**Version:** 2.0 — supersedes the original build spec. Reflects the corrected verification model (single-camera, multi-frame) and the full municipal workflow (Officer Review → Work Team → Senior Oversight).
**Companion documents:** `CityEye_Production_PRD.docx` (stakeholder-facing), `CityEye_Security_Design.md` (access control detail)

---

## 1. What Changed From v1 (Read This First)

| v1 assumption | v2 correction |
|---|---|
| Verification could involve multiple cameras confirming the same issue | **Most sites have only one camera.** Verification is **multi-frame, single-camera** — the same camera confirms the issue across several consecutive frames of its own footage. Nothing here required multiple cameras in the first place; this was a naming mix-up (multi-*frame* vs multi-*camera*), not a redesign. |
| One generic "reviewer" approves/rejects | **Three distinct roles** now exist: `officer` (reviews and approves/rejects), `work_team` (executes the repair, reports back), `senior_officer` (read-only oversight across everything) |
| Complaint status: `pending_review → approved/rejected → sent → resolved` | Status now models the full lifecycle: `pending_officer_review → approved/rejected → assigned → in_progress → resolved` |
| SQLite acceptable for MVP | **PostgreSQL required** — multiple roles read/write the same record over time; needs real concurrent-write safety |
| No authentication needed | **JWT-based authentication with role-based access control (RBAC) required** — three roles need three different permission sets |

---

## 2. System Flow (End to End)

```
1. Camera records footage (one camera per site — no cross-camera confirmation assumed or required)
2. AI (YOLOv8) detects a candidate problem in a frame
3. Verification service confirms the SAME candidate appears across multiple
   CONSECUTIVE FRAMES from that SAME camera (temporal confirmation, not
   cross-camera confirmation)
4. Evidence image saved, severity calculated, camera's registered location attached
5. Complaint Generator (LLM + template fallback) produces a readable report
6. Report enters the system with status: pending_officer_review
7. A logged-in OFFICER reviews it on the dashboard → approves or rejects
8. Approved reports are assigned to a WORK_TEAM (status: assigned)
9. Work team updates status to in_progress, then resolved, attaching a
   resolution photo and notes
10. A SENIOR_OFFICER can view the full status of every report at every stage,
    at any time, but cannot edit or approve anything (read-only oversight)
```

---

## 3. Database Schema (v2)

### `users`
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| name | text | |
| email | text, unique | login identifier |
| password_hash | text | never store plaintext — see Security Design doc |
| role | enum: `officer`, `work_team`, `senior_officer` | determines dashboard view and permissions |
| team_name | text, nullable | only relevant for `work_team` role (e.g., "Road Maintenance Crew 2") |
| is_active | boolean | default true |
| created_at | timestamptz | |

### `cameras`
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| name | text | |
| latitude | double precision | |
| longitude | double precision | |
| address | text | |
| is_active | boolean | |
| created_at | timestamptz | |

### `detections`
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| camera_id | UUID, FK → cameras.id | |
| problem_type | enum: `pothole`, `garbage`, `waterlogging` | |
| status | enum: `candidate`, `confirmed`, `rejected_false_positive` | |
| confidence | float | |
| bbox_x1, bbox_y1, bbox_x2, bbox_y2 | float | normalized 0–1 |
| frame_area_ratio | float | |
| confirmed_frame_count | int | how many consecutive frames from the SAME camera matched |
| first_seen_at | timestamptz | |
| confirmed_at | timestamptz | nullable |
| evidence_image_path | text | file path, not the image itself (see PRD Section on data storage) |
| severity_score | float | nullable until calculated |
| severity_label | enum: `low`, `medium`, `high` | |
| created_at | timestamptz | |

### `reports` (renamed from `complaints` to match municipal terminology used by the team)
| Column | Type | Notes |
|---|---|---|
| id | UUID, PK | |
| detection_id | UUID, FK → detections.id, unique | |
| title | text | |
| description | text | |
| citizen_summary | text | |
| recommended_department | text | |
| generation_source | enum: `llm`, `template_fallback` | |
| status | enum: `pending_officer_review`, `approved`, `rejected`, `assigned`, `in_progress`, `resolved` | see Section 4 |
| reviewed_by | UUID, FK → users.id, nullable | must have role = officer |
| reviewed_at | timestamptz, nullable | |
| rejection_reason | text, nullable | required if status = rejected |
| assigned_team | UUID, FK → users.id, nullable | must have role = work_team |
| assigned_at | timestamptz, nullable | |
| in_progress_at | timestamptz, nullable | |
| resolution_photo_path | text, nullable | proof-of-fix image, file path only |
| resolution_notes | text, nullable | |
| resolved_by | UUID, FK → users.id, nullable | |
| resolved_at | timestamptz, nullable | |
| created_at | timestamptz | |

**Indexes:** `detections(camera_id, status)`, `reports(status)`, `reports(assigned_team)` — dashboard views filter on these constantly, especially the work team's "my assigned reports" view.

---

## 4. Report Status Workflow

```
pending_officer_review
        │
        ├──► rejected  (terminal — requires rejection_reason)
        │
        └──► approved
                │
                ▼
             assigned   (officer assigns to a work_team user)
                │
                ▼
            in_progress (work_team marks they've started)
                │
                ▼
             resolved   (work_team submits resolution_photo_path + resolution_notes)
```

**Permission rules for each transition** (enforced server-side, not just hidden in the UI):
- `pending_officer_review → approved/rejected`: only a user with role `officer`
- `approved → assigned`: only a user with role `officer` (assigns to a specific work_team user)
- `assigned → in_progress → resolved`: only the `work_team` user the report is assigned to
- `senior_officer`: cannot trigger ANY transition — read access only, enforced at the API level, not just hidden in the frontend

---

## 5. Verification Logic (Corrected — Single Camera, Multi-Frame)

This is unchanged in substance from v1, just stated precisely to avoid the earlier confusion:

1. For each new frame's detections, compare against the most recent candidate of the same `problem_type` **from that same camera_id**.
2. Consider it the same object if IoU (Intersection over Union) between bounding boxes is `>= 0.5`.
3. If matched: increment `confirmed_frame_count`.
4. Once `confirmed_frame_count >= 5` (tunable), mark `status = confirmed`, save evidence image, trigger severity scoring and report generation.
5. **This never requires input from a second camera.** A location with exactly one camera works identically to a location with several — verification only ever looks at that one camera's own frame sequence over time.

---

## 6. API Endpoints (v2, with role restrictions)

All endpoints require a valid JWT except login. Prefix: `/api/v1`

| Method | Path | Who can call it | Purpose |
|---|---|---|---|
| POST | `/auth/login` | anyone | returns JWT + role |
| GET | `/cameras` | officer, senior_officer | list cameras |
| POST | `/cameras` | officer | register a camera |
| GET | `/detections` | officer, senior_officer | list detections, filterable |
| GET | `/reports` | officer, work_team (own only), senior_officer (all) | list reports — response is filtered server-side by role |
| GET | `/reports/{id}` | officer, assigned work_team, senior_officer | full report detail |
| PATCH | `/reports/{id}/review` | officer only | `{decision: "approved"|"rejected", rejection_reason?: string}` |
| PATCH | `/reports/{id}/assign` | officer only | `{assigned_team: user_id}` |
| PATCH | `/reports/{id}/progress` | assigned work_team only | `{status: "in_progress"}` |
| PATCH | `/reports/{id}/resolve` | assigned work_team only | `{resolution_photo_path, resolution_notes}` |
| GET | `/stats/dashboard` | all roles, content varies by role | officer sees pending queue counts; work_team sees their own assignment counts; senior_officer sees full system stats |

**Critical implementation note:** role checks must happen in the backend (e.g., a FastAPI dependency that reads the JWT and checks role before running the endpoint logic), never only in the frontend. A work_team user must be technically unable to call `/reports/{id}/review`, not just prevented from seeing the button for it.

---

## 7. Tech Stack (v2)

| Layer | Technology | Change from v1 |
|---|---|---|
| Detection | YOLOv8, fine-tuned | unchanged |
| Video processing | OpenCV | unchanged |
| Backend | FastAPI (Python) | unchanged |
| Database | **PostgreSQL** | upgraded from SQLite — required now for safe concurrent multi-role writes |
| Authentication | **JWT (via `python-jose` or `fastapi-users`), password hashing via `passlib`/bcrypt** | new in v2 |
| LLM | Claude API, with template fallback | unchanged |
| Frontend | React + Leaflet | unchanged |
| Evidence/resolution photo storage | Local disk (MVP), path stored in DB | unchanged |

---

## 8. Dashboard Requirements (v2 — now three views, not one)

**Officer view:**
- Queue of `pending_officer_review` reports with evidence photo, Approve/Reject actions
- Once approved, an Assign-to-team action
- List of previously reviewed reports (audit trail)

**Work team view:**
- List of reports assigned specifically to them (`assigned_team = current user`)
- "Start Work" button (→ `in_progress`), "Mark Resolved" form (upload photo + notes)

**Senior officer view:**
- Read-only dashboard: map of all reports colored by status, summary counts by status/severity/department, no action buttons at all
- This view is the one most worth polishing for your final demo — it's the most visually impressive and easiest for a jury to understand at a glance

---

## 9. Build Order (Updated)

1. Database schema + migrations (Section 3), including the `users` table with roles
2. Authentication: login endpoint, JWT issuing, password hashing — build and test this in isolation before anything else touches it
3. Detection model + verification service (Sections mostly unchanged from v1)
4. Severity scoring, complaint/report generation (template first, then LLM)
5. Backend API endpoints (Section 6) — test each with a real JWT for each role, confirm role restrictions actually reject wrong roles (not just hide UI)
6. Officer dashboard view
7. Work team dashboard view
8. Senior officer dashboard view (read-only, can be built in parallel with the above two once the API is stable)
9. Full integration test: one detection walked manually through every status from `pending_officer_review` to `resolved`, confirming the right role is required at each step
10. Docker Compose for full local deployment

---

## 10. Acceptance Criteria (v2)

- [ ] A confirmed detection from a single-camera site produces a report without requiring any second camera's input
- [ ] An `officer` user can approve/reject a report; a `work_team` or `senior_officer` user attempting the same API call is rejected (403), not just hidden from in the UI
- [ ] An approved report can be assigned to a specific work_team user, and only that user can move it to `in_progress` and `resolved`
- [ ] A `senior_officer` can view every report at every stage but cannot successfully call any state-changing endpoint
- [ ] Resolution requires both a photo and notes before status can move to `resolved`
- [ ] Full pipeline (detection → officer approval → assignment → resolution) is demonstrable end-to-end via `docker-compose up`

---

*Any deviation from this spec during implementation should be recorded here, not left undocumented — this is the shared reference for all four team members and any AI coding agent working from it.*
