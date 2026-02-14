/**
 * One-off script: Update all mitigation step dates to be in the future.
 * Preserves relative spacing between steps. Run from server dir:
 *   npx tsx scripts/update-mitigation-dates.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const steps = await prisma.mitigationStep.findMany({
    where: {
      OR: [
        { estimatedStartDate: { not: null } },
        { estimatedEndDate: { not: null } },
      ],
    },
  });

  if (steps.length === 0) {
    console.log("No mitigation steps with dates found.");
    return;
  }

  const dates: Date[] = [];
  for (const s of steps) {
    if (s.estimatedStartDate) dates.push(s.estimatedStartDate);
    if (s.estimatedEndDate) dates.push(s.estimatedEndDate);
  }

  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const now = new Date();
  const targetStart = new Date(now.getFullYear(), now.getMonth() + 1, 15); // 15th of next month
  const offsetMs = targetStart.getTime() - minDate.getTime();

  console.log(`Found ${steps.length} mitigation steps with dates.`);
  console.log(`Earliest date: ${minDate.toISOString().slice(0, 10)}`);
  console.log(`Shifting to start at: ${targetStart.toISOString().slice(0, 10)}`);

  let updated = 0;
  for (const s of steps) {
    const data: { estimatedStartDate?: Date | null; estimatedEndDate?: Date | null } = {};
    if (s.estimatedStartDate) {
      data.estimatedStartDate = new Date(s.estimatedStartDate.getTime() + offsetMs);
    }
    if (s.estimatedEndDate) {
      data.estimatedEndDate = new Date(s.estimatedEndDate.getTime() + offsetMs);
    }
    if (Object.keys(data).length > 0) {
      await prisma.mitigationStep.update({
        where: { id: s.id },
        data,
      });
      updated++;
    }
  }

  console.log(`Updated ${updated} mitigation steps.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
