# Security & Access Control Design
## CityEye — Municipal Infrastructure Monitoring System

**Purpose:** This document defines how CityEye authenticates users, controls what each role can do, and protects sensitive data. It's written to be owned and implemented by whoever on the team is handling backend security — it should evolve as decisions are tested, not stay static.

---

## 1. Why This Document Exists Separately

Most student projects treat security as an afterthought — a login form bolted on at the end. CityEye has a genuine reason to treat it as a first-class concern: the system controls **real-world actions** (a work team getting assigned a repair, an officer approving a public complaint) and handles **evidence photos of public infrastructure**, which carries real privacy weight even in a prototype. Getting this right is also one of the more defensible, mature-looking parts of the project in a jury evaluation.

---

## 2. Authentication

**Method:** JWT (JSON Web Token) — a small, signed piece of data issued to a user after they log in, which they attach to every subsequent request to prove who they are, without needing to send their password every time.

**Flow:**
1. User submits email + password to `POST /api/v1/auth/login`
2. Backend checks the password against a stored **hash** (never the plaintext password — see Section 3)
3. If valid, backend issues a JWT containing the user's `id` and `role`, signed with a secret key
4. The frontend stores this token and sends it in the `Authorization: Bearer <token>` header on every request
5. The backend verifies the token's signature on every request before doing anything else

**Token expiry:** set a reasonable expiry (e.g., 8 hours, matching a typical work shift) so a stolen/leaked token doesn't stay valid indefinitely. Require re-login after expiry.

---

## 3. Password Handling

- **Never store plaintext passwords.** Store only a hash, generated with `bcrypt` (via Python's `passlib` library).
- Bcrypt is deliberately slow — this is a feature, not a flaw. It makes brute-force password guessing computationally expensive even if the database is ever leaked.
- Minimum password requirements for this project (reasonable for a college build, not enterprise-grade): at least 8 characters. Real deployments would add more (complexity rules, rotation policy) — worth mentioning as a Phase 2 item in your report rather than over-engineering it now.

---

## 4. Role-Based Access Control (RBAC)

Three roles exist. The core security principle: **the backend enforces these rules, not the frontend.** Hiding a button in React is a UX nicety, not a security control — a technically capable person could still call the API directly. Every state-changing endpoint must independently check the caller's role from their JWT before doing anything.

### Permission Matrix

| Action | Officer | Work Team | Senior Officer |
|---|---|---|---|
| View all reports | ✅ | ❌ (own assignments only) | ✅ |
| View own assigned reports | — | ✅ | — |
| Approve / reject a report | ✅ | ❌ | ❌ |
| Assign a report to a work team | ✅ | ❌ | ❌ |
| Mark a report "in progress" | ❌ | ✅ (own assignments only) | ❌ |
| Mark a report "resolved" | ❌ | ✅ (own assignments only) | ❌ |
| View system-wide statistics | ✅ (own scope) | ❌ | ✅ (full) |
| Register a new camera | ✅ | ❌ | ❌ |
| Create/manage user accounts | Admin only* | ❌ | ❌ |

*User account management isn't detailed in the MVP scope — recommend a simple approach (e.g., an officer with an `is_admin` flag, or accounts pre-seeded by the dev team) rather than building a full admin panel, which isn't worth the time investment for this project.

### How to implement this in FastAPI (concept, not final code)

A reusable "dependency" function checks the JWT, extracts the role, and either lets the request through or returns a `403 Forbidden`. Each endpoint declares which roles it accepts:

```python
def require_role(*allowed_roles):
    def checker(current_user = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not authorized for this action")
        return current_user
    return checker

# Example usage on an endpoint:
# @router.patch("/reports/{id}/review")
# def review_report(id: str, user = Depends(require_role("officer"))):
#     ...
```

This pattern means every endpoint's permission requirement is visible right in its definition — easy to audit, easy to explain in a viva.

### Row-level restriction (beyond just role)

Role alone isn't enough for the work_team case — a work_team user should only see/act on reports **assigned specifically to them**, not every work_team member's reports. This needs an additional check: after confirming the role is `work_team`, also confirm `report.assigned_team == current_user.id` before allowing `in_progress`/`resolved` transitions. This is a common real-world security gap (checking role but forgetting to check ownership) — worth calling out explicitly in your report as something you deliberately handled.

---

## 5. Data Privacy — Evidence and Resolution Photos

- Evidence images may capture identifiable details of a public space (people, vehicles, plates). For the college build, this is generally lower-stakes than a live citywide deployment, but it's good practice to:
  - Restrict evidence photo access to authenticated users only — never serve images from a publicly accessible, unauthenticated URL
  - Avoid publishing raw evidence images anywhere outside the dashboard (e.g., don't post them in a public GitHub repo alongside your code)
- For a real production deployment (see the Production PRD), this expands into a formal retention policy and face/plate blurring — correctly scoped as Phase 2, not required for your prototype, but worth a sentence in your report showing you're aware of it.

---

## 6. API Input Validation

- Every endpoint that accepts data from a user (login form, resolution notes, camera registration) should validate input shape and type using FastAPI's built-in Pydantic models — this rejects malformed or unexpected data automatically, before it reaches your business logic.
- File uploads (resolution photos) should validate file type (only accept image formats) and a reasonable size limit, to avoid someone uploading an unexpected file type or an oversized file.

---

## 7. What's Deliberately Out of Scope for the College Build

Being explicit about this is itself good security practice — knowing your boundaries is part of the job:

- Rate limiting / DDoS protection (relevant at production scale, not for a local demo)
- Multi-factor authentication (a reasonable Phase 2 addition, not needed to prove the concept)
- Encrypted storage at rest for the database (relevant for a real cloud deployment; local/college demo doesn't need it)
- Formal penetration testing (appropriate before any real government pilot, not for an academic prototype)

Recommend listing these explicitly in your final report under "Security — Future Work," which turns an honest scope limitation into a demonstration of awareness.

---

## 8. Suggested Testing Checklist (for whoever owns this module)

- [ ] Attempt to call `/reports/{id}/review` while logged in as `work_team` — confirm it's rejected with 403
- [ ] Attempt to mark a report `resolved` that isn't assigned to the current work_team user — confirm it's rejected
- [ ] Confirm a `senior_officer` cannot successfully call any PATCH endpoint
- [ ] Confirm passwords are stored as bcrypt hashes, not plaintext, by inspecting the database directly
- [ ] Confirm an expired JWT is rejected on a protected endpoint
- [ ] Confirm evidence/resolution images cannot be accessed without a valid token

---

*This document should be updated as implementation choices are finalized — if a design decision here changes (e.g., token expiry time, hashing library), reflect it here so the whole team stays aligned.*
