# RIO Management

DoD RIO (Risk, Issue, and Opportunity) Management Tool — based on the DoD RIO Management Guide for Defense Acquisition Programs (September 2023).

## Hierarchy

```
Legal Entity (Company A, B, ...)
  └── Programs, Projects, Departments
        └── Risks, Issues, Opportunities (isolated per org unit)
```

Each Program, Project, and Department has its own isolated RIO set. Permissions (planned) will control who can view/edit each org unit or entity; see [docs/PERMISSIONS_AND_AUTH_SPEC.md](docs/PERMISSIONS_AND_AUTH_SPEC.md).

## Tech Stack

- **Backend:** Node.js, Express, TypeScript, Prisma
- **Database:** PostgreSQL
- **Frontend:** React, Vite, TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Setup

1. **Clone and install dependencies**

   ```bash
   cd ~/projects/rio-management
   npm install
   cd server && npm install
   cd ../client && npm install
   cd ..
   ```

2. **Database**

   Create a PostgreSQL database and set `DATABASE_URL` in `server/.env`:

   ```bash
   cp server/.env.example server/.env
   # Edit server/.env and set your DATABASE_URL
   # e.g. postgresql://user:pass@localhost:5432/rio_management
   ```

3. **Run migrations and seed**

   ```bash
   npm run db:migrate
   npm run db:seed
   ```

4. **Backfill risk versions** (for waterfall chart and version history)

   ```bash
   curl -X POST http://localhost:3001/api/risks/backfill-versions
   ```

   Run after starting the server — creates initial versions for existing risks.

5. **Start dev servers**

   ```bash
   npm run dev
   ```

   - API: http://localhost:3001  
   - Client: http://localhost:5173

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + client in dev mode |
| `npm run build` | Build server + client for production |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:update-mitigation-dates` | Update mitigation step dates (script) |

## Features

### Risks

- **Risk Register** — Add, edit risks with Category (Technical, Schedule, Cost, Other), Likelihood/Consequence, Status (Open → Mitigating → Accepted/Closed/Realized), Mitigation Strategy
- **5×5 Risk Matrix** — DoD MIL-STD-882 style; plot risks by Likelihood × Consequence; export PNG
- **Risk detail** — Condition, If/Then, mitigation strategy, mitigation steps (with dates, expected L/C), risk-to-issue conversion
- **Waterfall chart** — Risk level vs. time (portfolio evolution)
- **Version control** — Every risk create/update stores a snapshot; time-travel and audit log

### Issues

- **Issue Register** — Add, edit issues with Consequence (1–5), Category, Status (Control / Ignore), owner
- **1×5 Issue Matrix** — Plot issues by consequence; export PNG
- **Issue detail** — Resolution plan and resolution steps; create issue from realized risk

### Opportunities

- **Opportunity Register** — Add, edit opportunities with Likelihood × Impact, Category, Status (Pursue now, Defer, Reevaluate, Reject)
- **5×5 Opportunity Matrix** — Plot by Likelihood × Impact; export PNG
- **Opportunity detail** — Action plan and action plan steps; waterfall chart

### Settings

- **Legal Entities** — CRUD for legal entities
- **Programs / Projects / Departments** — CRUD for org units per entity
- **Risk Categories** — Manage category codes/labels (e.g. Technical, Schedule)
- **Opportunity Categories** — Separate category set for opportunities
- **Logo** — Upload a square logo shown in the header (GET/POST `/api/settings/logo`)

### Reports & Export

- **PowerPoint report** — Generate a .pptx from the template: executive summary, register overviews, section transitions, optional embedded matrix images (Risk, Issue, Opportunity), and deep-dive slides with mitigation/resolution/action steps
- **Export PNG** — Each matrix view can export to PNG at natural size (content-focused)

### Help

- **Help** — In-app user guide (scope, registers, matrices, filters, navigation).

## API Overview

| Area | Endpoints |
|------|-----------|
| **Health** | `GET /api/health` |
| **Legal entities** | `GET/POST/PATCH/DELETE /api/legal-entities`, `GET /api/legal-entities/:id` |
| **Org units** | `GET/POST/PATCH/DELETE /api/organizational-units`, `GET /api/organizational-units/:id` (query: `legalEntityId`) |
| **Categories** | `GET/POST/PATCH/DELETE /api/categories` |
| **Opportunity categories** | `GET/POST/PATCH/DELETE /api/opportunity-categories` |
| **Risks** | `GET/POST/PATCH/DELETE /api/risks`, `GET /api/risks/:id`, `GET /api/risks/:id/history`, `GET /api/risks/:id/audit-log`, `GET /api/risks/:id/mitigation-steps`, `POST/PATCH/DELETE /api/risks/:id/mitigation-steps(...)`, `GET /api/risks/waterfall/data`, `GET /api/risks/:id/waterfall`, `POST /api/risks/backfill-versions`, `POST /api/risks/:id/create-issue` |
| **Issues** | `GET/POST/PATCH/DELETE /api/issues`, `GET /api/issues/:id`, `GET /api/issues/:id/audit-log`, `GET /api/issues/:id/resolution-steps`, `POST/PATCH/DELETE /api/issues/:id/resolution-steps(...)`, `GET /api/issues/:id/waterfall` |
| **Opportunities** | `GET/POST/PATCH/DELETE /api/opportunities`, `GET /api/opportunities/:id`, `GET /api/opportunities/:id/audit-log`, `GET /api/opportunities/:id/history`, `GET /api/opportunities/:id/action-plan-steps`, `POST/PATCH/DELETE /api/opportunities/:id/action-plan-steps(...)`, `GET /api/opportunities/waterfall/data`, `GET /api/opportunities/:id/waterfall` |
| **Settings** | `GET /api/settings/logo`, `POST /api/settings/logo` (multipart) |

All list endpoints that are scoped by org unit use `?organizationalUnitId=...`.

## Project layout

- `client/` — Vite + React app (components, utils, types)
- `server/` — Express API, Prisma schema, migrations, seed, scripts
- `docs/` — Specs (e.g. permissions/auth)

## Roadmap

- [x] Risk Register, 5×5 Risk Matrix, waterfall, version history, mitigation steps
- [x] Issue Register, 1×5 Issue Matrix, resolution steps, create-issue from risk
- [x] Opportunity Register, 5×5 Opportunity Matrix, action plan steps, waterfall
- [x] Legal entities, org units, risk/opportunity categories
- [x] Logo upload and header branding
- [x] PowerPoint report generation (template + embedded matrix images)
- [x] Help documentation
- [ ] Authentication and permissions (see [docs/PERMISSIONS_AND_AUTH_SPEC.md](docs/PERMISSIONS_AND_AUTH_SPEC.md))
