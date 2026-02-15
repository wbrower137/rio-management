# Risk versioning – when is a new version recorded?

A new **risk version** is recorded in exactly these circumstances:

## 1. On risk creation (POST `/api/risks`)

- When a risk is created, **version 1** is always created in the same database transaction as the risk.
- So every risk should have at least one row in `RiskVersion` (v1) as soon as it exists.
- Implemented in: `server/src/routes/risks.ts` – `riskRoutes.post("/", ...)` uses `prisma.$transaction` to create the risk and then `createRiskVersion(r.id, r, undefined, tx)`.

## 2. On every risk update (PATCH `/api/risks/:id`)

- **Every** successful PATCH to a risk creates a new version, regardless of which fields changed.
- That includes changes to: **riskName**, **riskCondition**, **riskIf**, **riskThen**, **category**, **likelihood**, **consequence**, **mitigationStrategy**, **mitigationPlan**, **owner**, **status**.
- The handler:
  1. Updates the risk with `prisma.risk.update(...)`.
  2. Then always calls `createRiskVersion(risk.id, risk, { likelihoodChangeReason?, consequenceChangeReason?, statusChangeRationale? })`.
- So changing only condition, if, then, or status (or any other editable field) should produce a new version and it should appear in history.
- Implemented in: `server/src/routes/risks.ts` – `riskRoutes.patch("/:id", ...)` (around lines 723–808).

## 3. Backfill (GET `/api/risks/:id/history`)

- When you fetch history for a risk that has **no** versions in the DB, the history handler may create **version 1** from the current risk state (backfill) so the UI can show “Risk created.”
- This is only for risks that already exist but have no `RiskVersion` rows (e.g. created before versioning existed).

---

## Summary

| Event | New version? |
|-------|----------------|
| Create risk (POST) | Yes – v1 in same transaction |
| Update risk (PATCH) – any field(s) | Yes – new version every time |
| Delete risk | N/A (risk and versions are removed) |
| Fetch history only (GET history) | No (backfill can create v1 if none exist) |

So by design, **every change to condition, if, then, status, or any other risk field via PATCH should create a new version and that version should show in the History tab** (which uses GET `/api/risks/:id/history`).
