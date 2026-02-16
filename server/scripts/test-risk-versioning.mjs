/**
 * Risk versioning tests – run against a live API (server must be running).
 *
 * Prerequisites:
 *   - Server: npm run dev:server (or start server) so API is at http://localhost:3001
 *   - DB seeded so there is at least one entity and one org unit
 *
 * Run: node server/scripts/test-risk-versioning.mjs
 *   (from repo root) or: node scripts/test-risk-versioning.mjs (from server/)
 */

const API = "http://localhost:3001/api";

async function get(path) {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function post(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

async function patch(path, body) {
  const r = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

function countRiskVersions(history) {
  return history.filter((e) => e.type === "risk").length;
}

async function main() {
  console.log("Risk versioning tests (API must be running at", API, ")\n");

  let passed = 0;
  let failed = 0;

  // Resolve org unit id
  const entities = await get("/legal-entities");
  if (!entities.length) {
    console.log("FAIL: No entities. Run db:seed.");
    process.exit(1);
  }
  const units = await get(`/organizational-units?legalEntityId=${entities[0].id}`);
  if (!units.length) {
    console.log("FAIL: No org units. Run db:seed.");
    process.exit(1);
  }
  const orgUnitId = units[0].id;

  // 1) Create risk → expect at least 1 version (v1)
  const risk = await post("/risks", {
    organizationalUnitId: orgUnitId,
    riskName: "Versioning test risk",
    riskCondition: "Condition A",
    riskIf: "If A",
    riskThen: "Then A",
    status: "open",
  });
  const historyAfterCreate = await get(`/risks/${risk.id}/history`);
  const versionsAfterCreate = countRiskVersions(historyAfterCreate);
  if (versionsAfterCreate >= 1) {
    console.log("PASS: After create, history has at least 1 risk version (got " + versionsAfterCreate + ")");
    passed++;
  } else {
    console.log("FAIL: After create, expected >= 1 risk version, got " + versionsAfterCreate);
    failed++;
  }

  // 2) PATCH riskCondition → expect one more version
  await patch(`/risks/${risk.id}`, { riskCondition: "Condition B" });
  const historyAfterCondition = await get(`/risks/${risk.id}/history`);
  const versionsAfterCondition = countRiskVersions(historyAfterCondition);
  if (versionsAfterCondition >= 2) {
    console.log("PASS: After PATCH riskCondition, history has >= 2 risk versions (got " + versionsAfterCondition + ")");
    passed++;
  } else {
    console.log("FAIL: After PATCH riskCondition, expected >= 2 risk versions, got " + versionsAfterCondition);
    failed++;
  }

  // 3) PATCH riskIf → expect one more version
  await patch(`/risks/${risk.id}`, { riskIf: "If B" });
  const historyAfterIf = await get(`/risks/${risk.id}/history`);
  const versionsAfterIf = countRiskVersions(historyAfterIf);
  if (versionsAfterIf >= 3) {
    console.log("PASS: After PATCH riskIf, history has >= 3 risk versions (got " + versionsAfterIf + ")");
    passed++;
  } else {
    console.log("FAIL: After PATCH riskIf, expected >= 3 risk versions, got " + versionsAfterIf);
    failed++;
  }

  // 4) PATCH riskThen → expect one more version
  await patch(`/risks/${risk.id}`, { riskThen: "Then B" });
  const historyAfterThen = await get(`/risks/${risk.id}/history`);
  const versionsAfterThen = countRiskVersions(historyAfterThen);
  if (versionsAfterThen >= 4) {
    console.log("PASS: After PATCH riskThen, history has >= 4 risk versions (got " + versionsAfterThen + ")");
    passed++;
  } else {
    console.log("FAIL: After PATCH riskThen, expected >= 4 risk versions, got " + versionsAfterThen);
    failed++;
  }

  // 5) PATCH status to closed (with rationale) → expect one more version
  await patch(`/risks/${risk.id}`, {
    status: "closed",
    statusChangeRationale: "Test rationale for closing",
  });
  const historyAfterStatus = await get(`/risks/${risk.id}/history`);
  const versionsAfterStatus = countRiskVersions(historyAfterStatus);
  if (versionsAfterStatus >= 5) {
    console.log("PASS: After PATCH status, history has >= 5 risk versions (got " + versionsAfterStatus + ")");
    passed++;
  } else {
    console.log("FAIL: After PATCH status, expected >= 5 risk versions, got " + versionsAfterStatus);
    failed++;
  }

  // Summary
  console.log("\n---");
  console.log("Result:", passed, "passed,", failed, "failed");
  if (failed > 0) process.exit(1);
  console.log("All versioning checks passed.");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
