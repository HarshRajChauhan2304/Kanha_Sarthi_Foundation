# ROLE-BASED ACCESS CONTROL (RBAC) PERMISSION MATRIX

**Application:** Kanha Sarthi Foundation  
**Enforced Roles:** `ADMIN` | `USER` | `VOLUNTEER`  

---

## 1. Role Definitions

| Role | Target Persona | Scope of Authorization |
|:---|:---|:---|
| **ADMIN** | NGO Executive / System Administrator | Full administrative control over all platform modules, users, volunteers, content, donations, and security audit logs. |
| **USER** | Donor, Supporter, General Public | Public reading, self-profile management, personal donation history, donation payment flow, volunteer application submission. |
| **VOLUNTEER** | Approved Foundation Volunteer | Self-profile management, assigned activity execution, task proof media submission, activity feedback. |

---

## 2. Feature & Endpoint Permission Matrix

| Feature / Resource | Endpoint | ADMIN | USER | VOLUNTEER | Public / Anon |
|:---|:---|:---:|:---:|:---:|:---:|
| **Admin Dashboard** | `/admin`, `/admin/*` | ✅ Full | ❌ Denied | ❌ Denied | ❌ Denied |
| **User Management** | `/api/admin/users` | ✅ Full CRUD | ❌ Denied | ❌ Denied | ❌ Denied |
| **Role Promotion** | `/api/admin/promote` | ✅ Full CRUD | ❌ Denied | ❌ Denied | ❌ Denied |
| **Security Audit Logs** | `/api/admin/audit-logs` | ✅ Read Only | ❌ Denied | ❌ Denied | ❌ Denied |
| **Volunteer Applications** | `/api/volunteer` (GET) | ✅ All Records | ❌ Denied | ⚠️ Own Record | ❌ Denied |
| **Volunteer Approval** | `/api/volunteer/approve` | ✅ Full | ❌ Denied | ❌ Denied | ❌ Denied |
| **Volunteer Registration**| `/api/volunteer` (POST) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Volunteer Profile Edit** | `/api/volunteer` (PUT) | ✅ Full | ❌ Denied | ⚠️ Own Info Only | ❌ Denied |
| **Volunteer Tasks (Create)**| `/api/volunteer/tasks` (POST) | ✅ Allowed | ❌ Denied | ❌ Denied | ❌ Denied |
| **Volunteer Tasks (View)** | `/api/volunteer/tasks` (GET) | ✅ All Tasks | ❌ Denied | ⚠️ Assigned Tasks | ❌ Denied |
| **Volunteer Tasks (Update)**| `/api/volunteer/tasks` (PUT) | ✅ Full | ❌ Denied | ⚠️ Status/Proof Only | ❌ Denied |
| **Public Website CMS** | `/api/causes`, `/api/blogs` | ✅ Full CRUD | 👁️ Read Only | 👁️ Read Only | 👁️ Read Only |
| **Donation Execution** | `/api/payment/create-order` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Donation Verification** | `/api/payment/verify-order` | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Personal Donation History** | `/api/donations/by-user` | ✅ All Records | ⚠️ Own History | ⚠️ Own History | ❌ Denied |
| **Contact Inquiries (View)** | `/api/contact` (GET) | ✅ Allowed | ❌ Denied | ❌ Denied | ❌ Denied |
| **Contact Inquiries (Send)** | `/api/contact` (POST) | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **File Upload (5MB Whitelist)**| `/api/upload` | ✅ 20/hr | ✅ 20/hr | ✅ 20/hr | ⚠️ Restricted |

---

## 3. Privilege Escalation Defenses

1. **Role Immutability:** Any request from a `USER` or `VOLUNTEER` attempting to set or modify `role: "admin"` is stripped server-side.
2. **Server-Side Validation:** The backend completely ignores the `role` field sent in frontend payloads; roles are loaded exclusively from server-side cryptographic tokens or the authenticated database record.
3. **Approval Gate:** Volunteers cannot access volunteer dashboards until an authorized `ADMIN` explicitly approves the application.
4. **IDOR Prevention:** Any mutation on `/api/user/auth` (update) or `/api/volunteer` (update) strictly validates that `auth.user.email === resource.email` or `auth.user.role === 'admin'`.
