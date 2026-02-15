/**
 * Deletes duplicate risks (same organizationalUnitId + riskName).
 * Keeps the risk with the earliest createdAt; deletes the rest.
 * Related MitigationStep, RiskVersion, and RiskAuditLog records cascade.
 *
 * Run: npx tsx prisma/scripts/dedupe-risks.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const risks = await prisma.risk.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, organizationalUnitId: true, riskName: true, createdAt: true },
  });

  const seen = new Map<string, string>();
  const toDelete: string[] = [];

  for (const r of risks) {
    const key = `${r.organizationalUnitId}::${r.riskName}`;
    if (seen.has(key)) {
      toDelete.push(r.id);
    } else {
      seen.set(key, r.id);
    }
  }

  if (toDelete.length === 0) {
    console.log("No duplicate risks found.");
    return;
  }

  console.log(`Found ${toDelete.length} duplicate risk(s) to delete.`);

  const result = await prisma.risk.deleteMany({
    where: { id: { in: toDelete } },
  });

  console.log(`Deleted ${result.count} duplicate risk(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
