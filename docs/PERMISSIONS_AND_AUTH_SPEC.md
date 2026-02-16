# RIO Management — Permissions & Authentication Spec

> **Status:** Planning  
> **Target:** v4.0 (or post-v3.0)  
> **Audience:** Technical implementers, Okta admins, security reviewers

---

## 1. Authentication

### 1.1 Method

- **SSO via Okta (SAML)**
- Users authenticate through the company Okta tenant; no local username/password in RIO.

### 1.2 Technical Questions for Okta Admin / IT

| Question | Purpose |
|----------|---------|
| How is the RIO app registered in Okta? (SAML app name, audience, ACS URL) | Required for backend integration |
| What SAML attributes are sent? (e.g. `NameID`, `email`, `firstName`, `lastName`, `groups`) | Needed for user identity and display |
| Are there Okta groups or attributes that map to Admin / Editor / Viewer? | May simplify role assignment |
| Is there a dev/test Okta tenant and SAML app for development? | Required for safe integration work |
| What is the IdP metadata URL or XML for the SAML app? | Needed to configure SAML in the app |

### 1.3 User Identity in RIO

- Each user needs a stable identifier (e.g. Okta `NameID` or `email`) for:
  - Permissions lookups
  - Audit logs ("who did what")
  - Impersonation
- Display name (e.g. "John Smith") should be available for audit and UI.

---

## 2. Authorization — Permissions Model

### 2.1 Scope

- **Permission boundary:** Entity (LE) + Program/Project/Department (PPD)
- Permissions are granted per **LE/PPD combination**.
- There is **no org hierarchy** for permissions: an LE does not implicitly grant access to its PPDs.

### 2.2 Roles

| Role | Capabilities |
|------|--------------|
| **Admin** | Manage LE, PPD, Categories, Opp Categories; set user permissions; CRUD and delete for any LE/PPD |
| **Editor** | CRUD and delete Risks/Issues/Opportunities for **assigned** LE/PPD(s) |
| **Viewer** | Read-only for Risks/Issues/Opportunities for **assigned** LE/PPD(s) |

### 2.3 Capability Matrix

| Capability | Admin | Editor | Viewer |
|------------|:-----:|:------:|:------:|
| Manage Entities | ✅ | ❌ | ❌ |
| Manage Programs / Projects / Departments | ✅ | ❌ | ❌ |
| Manage Risk Categories | ✅ | ❌ | ❌ |
| Manage Opportunity Categories | ✅ | ❌ | ❌ |
| Set permissions for users (assign role + LE/PPD) | ✅ | ❌ | ❌ |
| CRUD Risks, Issues, Opportunities | ✅ (any LE/PPD) | ✅ (assigned only) | ❌ |
| Delete Risks, Issues, Opportunities | ✅ | ✅ | ❌ |
| Read Risks, Issues, Opportunities | ✅ | ✅ | ✅ (assigned only) |
| Impersonate another user | ✅ | ❌ | ❌ |

### 2.4 Granularity

- **No further granularity** within an LE/PPD.
- If a user has Editor access to a given LE/PPD, they can create, edit, and delete all Risks, Issues, and Opportunities in that scope.

---

## 3. Audit Logging

- **Requirement:** Log **who** made each change.
- **Fields to add:** `userId` (or Okta identifier) and `username` (display name) on each audit entry.
- **Applies to:** Risk audit log, Issue audit log, Opportunity audit log.
- **Impersonation:** When an Admin impersonates a user, audit entries should record both:
  - The **impersonated user** (who performed the action)
  - The **impersonator** (Admin who is acting on their behalf)

---

## 4. Impersonation

- **Who can impersonate:** Admin only.
- **Purpose:** Support and troubleshooting.
- **Audit:** All actions taken while impersonating must be clearly attributable to both the impersonated user and the impersonator.
- **UI:** Admin needs a way to start and end an impersonation session (e.g. "Act as [user]" / "Stop impersonating").

---

## 5. Data Model (Proposed)

### 5.1 User

- `id` (UUID)
- `externalId` (Okta identifier, e.g. `NameID`)
- `username` (email or login)
- `displayName` (for audit and UI)
- `email` (optional)
- `createdAt`, `updatedAt`

### 5.2 UserPermission

- `userId`
- `legalEntityId`
- `organizationalUnitId` (PPD)
- `role` (admin | editor | viewer)

A user may have multiple rows (different LE/PPD and/or roles). Admin can be represented either as a special role or as a global flag (e.g. `isAdmin`).

### 5.3 Audit Log Changes

- Add `userId` and `username` (or equivalent) to:
  - `RiskAuditLog`
  - `IssueAuditLog`
  - `OpportunityAuditLog`
- Optionally add `impersonatedByUserId` / `impersonatedByUsername` when applicable.

---

## 6. Implementation Checklist

### Phase 1: Authentication (Okta SAML)

- [ ] Obtain Okta SAML app config (metadata, ACS URL, entity ID)
- [ ] Add SAML handling (e.g. `passport-saml`, `@okta/okta-auth-js`, or similar)
- [ ] Create or update session/JWT flow after successful SAML login
- [ ] Implement logout (single logout if required)
- [ ] Add User table and sync/upsert on login

### Phase 2: Permissions

- [ ] Add `UserPermission` (or equivalent) table
- [ ] Add middleware to resolve current user from session/JWT
- [ ] Add middleware to check permission (role + LE/PPD) before each API call
- [ ] Update all RIO API routes to enforce permissions
- [ ] Add admin UI to assign permissions (user → role → LE/PPD)

### Phase 3: Audit & Impersonation

- [ ] Add `userId` / `username` to audit log creation
- [ ] Implement impersonation (Admin only, with audit)
- [ ] Update audit log display to show username

---

## 7. Open Questions

1. **Admin scope:** Is Admin always global, or can Admin be scoped to specific LE/PPD?
2. **Default role:** What happens when a user has no permissions? (e.g. block access vs. read-only)
3. **Okta groups:** Will roles be managed in RIO, or derived from Okta groups?
4. **Multi-session:** Any requirements for concurrent sessions, device limits, or session timeout?
5. **API access:** Will any non-browser clients (scripts, integrations) need API keys or service accounts?

---

## 8. References

- [Okta SAML Documentation](https://developer.okta.com/docs/concepts/saml/)
- [Okta Node.js / Express Integration](https://developer.okta.com/docs/guides/sign-into-web-app/nodeexpress/main/)
- RIO schema: `server/prisma/schema.prisma`
- Audit log patterns: `server/src/routes/risks.ts`, `server/src/routes/issues.ts`
