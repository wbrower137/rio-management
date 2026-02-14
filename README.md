# RIO Management

DoD RIO (Risk, Issue, and Opportunity) Management Tool — based on the DoD RIO Management Guide for Defense Acquisition Programs (September 2023).

## Hierarchy

```
Legal Entity (Company A, B, ...)
  └── Programs, Projects, Departments
        └── Risks, Issues, Opportunities (isolated per org unit)
```

Each Program, Project, and Department has its own isolated RIO set. Permissions (future) will control who can view/edit each org unit or legal entity.

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

   Or run this after starting the server — creates initial versions for existing risks.

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
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |

## API

- `GET /api/legal-entities` — List legal entities
- `GET /api/organizational-units?legalEntityId=...` — List org units
- `GET /api/risks?organizationalUnitId=...` — List risks (scoped by org unit)
- `POST /api/risks` — Create risk (requires `organizationalUnitId`)
- `PATCH /api/risks/:id` — Update risk (creates version snapshot)
- `GET /api/risks/:id/history` — Risk version history (time-travel)
- `GET /api/risks/waterfall/data?organizationalUnitId=...` — Waterfall chart data
- `POST /api/risks/backfill-versions` — Backfill versions for risks without history

## Features

- **Risk Register** — Add, edit risks with Category (Technical, Schedule, Cost, Other), Likelihood/Consequence, Status (Open → Mitigating → Accepted/Closed), Mitigation Strategy
- **5×5 Risk Matrix** — DoD MIL-STD-882 style; plot risks by Likelihood × Consequence
- **Waterfall Chart** — Risk level vs. time (aggregate portfolio evolution)
- **Version Control** — Every risk create/update stores a snapshot; supports time-travel view

## Roadmap

- [ ] Issue and Opportunity models + UI
- [x] 5×5 Risk Matrix visualization
- [x] Waterfall / risk vs. time chart
- [x] Audit logging (RiskVersion snapshots)
- [ ] Authentication and permissions
