import { PrismaClient } from "@prisma/client";
import { getNumericalRiskLevel, getRiskLevel } from "../src/lib/riskLevel.js";

const prisma = new PrismaClient();

function addMonths(d: Date, months: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() + months);
  return r;
}

async function main() {
  const companyA = await prisma.legalEntity.upsert({
    where: { code: "COMPANY-A" },
    update: {},
    create: {
      name: "Company A",
      code: "COMPANY-A",
      description: "Primary legal entity",
    },
  });

  const companyB = await prisma.legalEntity.upsert({
    where: { code: "COMPANY-B" },
    update: {},
    create: {
      name: "Company B",
      code: "COMPANY-B",
      description: "Secondary legal entity",
    },
  });

  const programAlpha = await prisma.organizationalUnit.upsert({
    where: {
      legalEntityId_type_code: {
        legalEntityId: companyA.id,
        type: "program",
        code: "PROG-ALPHA",
      },
    },
    update: {},
    create: {
      legalEntityId: companyA.id,
      type: "program",
      name: "Program Alpha",
      code: "PROG-ALPHA",
      description: "Defense acquisition program Alpha",
    },
  });

  const projectX = await prisma.organizationalUnit.upsert({
    where: {
      legalEntityId_type_code: {
        legalEntityId: companyA.id,
        type: "project",
        code: "PROJ-X",
      },
    },
    update: {},
    create: {
      legalEntityId: companyA.id,
      type: "project",
      name: "Project X",
      code: "PROJ-X",
      description: "Technology development project",
    },
  });

  // Opportunity categories: Growth, Partnership, Efficiency, Cost, Customer
  const oppCatData = [
    { code: "growth", label: "Growth", sortOrder: 0 },
    { code: "partnership", label: "Partnership", sortOrder: 1 },
    { code: "efficiency", label: "Efficiency", sortOrder: 2 },
    { code: "cost", label: "Cost", sortOrder: 3 },
    { code: "customer", label: "Customer", sortOrder: 4 },
  ];
  for (const c of oppCatData) {
    await prisma.opportunityCategory.upsert({
      where: { code: c.code },
      update: {},
      create: c,
    });
  }

  const deptEng = await prisma.organizationalUnit.upsert({
    where: {
      legalEntityId_type_code: {
        legalEntityId: companyA.id,
        type: "department",
        code: "DEPT-ENG",
      },
    },
    update: {},
    create: {
      legalEntityId: companyA.id,
      type: "department",
      name: "Engineering",
      code: "DEPT-ENG",
      description: "Engineering department",
    },
  });

  // Company B: Program with 5 risks (4 with mitigation plans of 3+ steps, 1 without)
  const progBravo = await prisma.organizationalUnit.upsert({
    where: {
      legalEntityId_type_code: {
        legalEntityId: companyB.id,
        type: "program",
        code: "PROG-BRAVO",
      },
    },
    update: {},
    create: {
      legalEntityId: companyB.id,
      type: "program",
      name: "Program Bravo",
      code: "PROG-BRAVO",
      description: "Company B main program",
    },
  });

  // Company B: Department with 8 risks (1 with 7 steps, 3 with 4 steps, 4 without)
  const deptOperations = await prisma.organizationalUnit.upsert({
    where: {
      legalEntityId_type_code: {
        legalEntityId: companyB.id,
        type: "department",
        code: "DEPT-OPS",
      },
    },
    update: {},
    create: {
      legalEntityId: companyB.id,
      type: "department",
      name: "Operations",
      code: "DEPT-OPS",
      description: "Company B operations department",
    },
  });

  const riskCount = await prisma.risk.count();
  if (riskCount > 0) {
    console.log("DB already has risks. Skipping seed to avoid duplicates.");
    return;
  }

  // Use a future base date so mitigation steps are all in the future (for testing close-out flows)
  const today = new Date();
  const baseDate = new Date(today.getFullYear(), today.getMonth() + 1, 15); // 15th of next month

  // Program Bravo - 5 risks
  const r1 = await prisma.risk.create({
    data: {
      organizationalUnitId: progBravo.id,
      riskName: "Requirements volatility",
      riskLevel: getRiskLevel(4, 4),
      riskCondition: "Stakeholder needs evolving; multiple change requests pending.",
      riskIf: "requirements continue to change without adequate baseline control",
      riskThen: "scope creep will drive cost and schedule overruns.",
      category: "technical",
      originalLikelihood: 4,
      originalConsequence: 4,
      likelihood: 4,
      consequence: 4,
      mitigationStrategy: "control",
      owner: "PM",
      status: "mitigating",
    },
  });
  for (let i = 0; i < 3; i++) {
    const el = 4 - i;
    const ec = 4 - Math.floor(i / 2);
    await prisma.mitigationStep.create({
      data: {
        riskId: r1.id,
        sequenceOrder: i,
        mitigationActions: `Phase ${i + 1}: Requirements baseline and change control`,
        closureCriteria: `Requirements baseline approved; change board established`,
        estimatedStartDate: addMonths(baseDate, i * 2),
        estimatedEndDate: addMonths(baseDate, (i + 1) * 2),
        expectedLikelihood: Math.max(1, el),
        expectedConsequence: Math.max(1, ec),
        expectedRiskLevel: getNumericalRiskLevel(Math.max(1, el), Math.max(1, ec)),
      },
    });
  }

  const r2 = await prisma.risk.create({
    data: {
      organizationalUnitId: progBravo.id,
      riskName: "Test environment availability",
      riskLevel: getRiskLevel(3, 3),
      riskCondition: "Lab capacity shared across programs; scheduling conflicts.",
      riskIf: "test environment is unavailable when needed",
      riskThen: "integration and qualification testing will slip.",
      category: "schedule",
      originalLikelihood: 3,
      originalConsequence: 3,
      likelihood: 3,
      consequence: 3,
      mitigationStrategy: "control",
      owner: "Test Lead",
      status: "mitigating",
    },
  });
  for (let i = 0; i < 4; i++) {
    const el = 3 - Math.floor(i / 2);
    const ec = 3 - Math.floor(i / 3);
    await prisma.mitigationStep.create({
      data: {
        riskId: r2.id,
        sequenceOrder: i,
        mitigationActions: `Step ${i + 1}: Secure lab slots and backup capacity`,
        closureCriteria: `Lab slots reserved; MOU with alternate site`,
        estimatedStartDate: addMonths(baseDate, i),
        estimatedEndDate: addMonths(baseDate, i + 1),
        expectedLikelihood: Math.max(1, el),
        expectedConsequence: Math.max(1, ec),
        expectedRiskLevel: getNumericalRiskLevel(Math.max(1, el), Math.max(1, ec)),
      },
    });
  }

  const r3 = await prisma.risk.create({
    data: {
      organizationalUnitId: progBravo.id,
      riskName: "Key person dependency",
      riskLevel: getRiskLevel(3, 4),
      riskCondition: "Critical expertise concentrated in few individuals.",
      riskIf: "key person becomes unavailable",
      riskThen: "progress will stall and knowledge transfer will be delayed.",
      category: "technical",
      originalLikelihood: 3,
      originalConsequence: 4,
      likelihood: 3,
      consequence: 4,
      mitigationStrategy: "control",
      owner: "Eng Manager",
      status: "mitigating",
    },
  });
  for (let i = 0; i < 3; i++) {
    const el = 3 - i;
    const ec = 4 - Math.min(i, 2);
    await prisma.mitigationStep.create({
      data: {
        riskId: r3.id,
        sequenceOrder: i,
        mitigationActions: `Mitigation ${i + 1}: Cross-training and documentation`,
        closureCriteria: `Backup identified; procedures documented`,
        estimatedStartDate: addMonths(baseDate, i * 2),
        estimatedEndDate: addMonths(baseDate, (i + 1) * 2),
        expectedLikelihood: Math.max(1, el),
        expectedConsequence: Math.max(1, ec),
        expectedRiskLevel: getNumericalRiskLevel(Math.max(1, el), Math.max(1, ec)),
      },
    });
  }

  const r4 = await prisma.risk.create({
    data: {
      organizationalUnitId: progBravo.id,
      riskName: "Supply chain disruption",
      riskLevel: getRiskLevel(2, 5),
      riskCondition: "Geopolitical tensions affecting component availability.",
      riskIf: "supply chain is disrupted for critical parts",
      riskThen: "production will halt and program schedule will slip.",
      category: "schedule",
      originalLikelihood: 2,
      originalConsequence: 5,
      likelihood: 2,
      consequence: 5,
      mitigationStrategy: "transfer",
      owner: "Supply Chain",
      status: "open",
    },
  });
  for (let i = 0; i < 4; i++) {
    const el = 2;
    const ec = 5 - i;
    await prisma.mitigationStep.create({
      data: {
        riskId: r4.id,
        sequenceOrder: i,
        mitigationActions: `Action ${i + 1}: Diversify suppliers and build inventory`,
        closureCriteria: `Alternate sources qualified; buffer stock on hand`,
        estimatedStartDate: addMonths(baseDate, i * 3),
        estimatedEndDate: addMonths(baseDate, (i + 1) * 3),
        expectedLikelihood: el,
        expectedConsequence: Math.max(1, ec),
        expectedRiskLevel: getNumericalRiskLevel(el, Math.max(1, ec)),
      },
    });
  }

  const r5 = await prisma.risk.create({
    data: {
      organizationalUnitId: progBravo.id,
      riskName: "Regulatory approval delay",
      riskLevel: getRiskLevel(2, 3),
      riskCondition: "Regulatory review timeline uncertain.",
      riskIf: "approval is delayed beyond planned dates",
      riskThen: "fielding will slip and contract milestones may be missed.",
      category: "other",
      originalLikelihood: 2,
      originalConsequence: 3,
      likelihood: 2,
      consequence: 3,
      mitigationStrategy: "acceptance",
      owner: "Compliance",
      status: "open",
    },
  });
  // r5 has no mitigation steps

  // Department Operations - 8 risks
  const d1 = await prisma.risk.create({
    data: {
      organizationalUnitId: deptOperations.id,
      riskName: "Process maturity gaps",
      riskLevel: getRiskLevel(4, 4),
      riskCondition: "Operating procedures incomplete; training gaps identified.",
      riskIf: "processes are not matured before operations begin",
      riskThen: "errors and inefficiencies will impact mission readiness.",
      category: "technical",
      originalLikelihood: 4,
      originalConsequence: 4,
      likelihood: 4,
      consequence: 4,
      mitigationStrategy: "control",
      owner: "Ops Lead",
      status: "mitigating",
    },
  });
  for (let i = 0; i < 7; i++) {
    const el = 4 - Math.floor(i / 2);
    const ec = 4 - Math.floor(i / 3);
    await prisma.mitigationStep.create({
      data: {
        riskId: d1.id,
        sequenceOrder: i,
        mitigationActions: `Maturity step ${i + 1}: Develop, review, and deploy process improvements`,
        closureCriteria: `Process ${i + 1} documented and trained`,
        estimatedStartDate: addMonths(baseDate, i),
        estimatedEndDate: addMonths(baseDate, i + 1),
        expectedLikelihood: Math.max(1, el),
        expectedConsequence: Math.max(1, ec),
        expectedRiskLevel: getNumericalRiskLevel(Math.max(1, el), Math.max(1, ec)),
      },
    });
  }

  const d2 = await prisma.risk.create({
    data: {
      organizationalUnitId: deptOperations.id,
      riskName: "Equipment obsolescence",
      riskLevel: getRiskLevel(3, 4),
      riskCondition: "Legacy systems approaching end of support.",
      riskIf: "vendors discontinue support before replacement",
      riskThen: "operational availability will degrade.",
      category: "technical",
      originalLikelihood: 3,
      originalConsequence: 4,
      likelihood: 3,
      consequence: 4,
      mitigationStrategy: "control",
      owner: "Tech Lead",
      status: "mitigating",
    },
  });
  for (let i = 0; i < 4; i++) {
    const el = 3 - Math.floor(i / 2);
    const ec = 4 - i;
    await prisma.mitigationStep.create({
      data: {
        riskId: d2.id,
        sequenceOrder: i,
        mitigationActions: `Replacement phase ${i + 1}: Assess, procure, deploy`,
        closureCriteria: `Equipment refreshed; support extended`,
        estimatedStartDate: addMonths(baseDate, i * 2),
        estimatedEndDate: addMonths(baseDate, (i + 1) * 2),
        expectedLikelihood: Math.max(1, el),
        expectedConsequence: Math.max(1, ec),
        expectedRiskLevel: getNumericalRiskLevel(Math.max(1, el), Math.max(1, ec)),
      },
    });
  }

  const d3 = await prisma.risk.create({
    data: {
      organizationalUnitId: deptOperations.id,
      riskName: "Workforce turnover",
      riskLevel: getRiskLevel(4, 3),
      riskCondition: "Competitive job market; retention challenges.",
      riskIf: "critical staff leave before replacements are trained",
      riskThen: "capacity gaps will impact delivery.",
      category: "cost",
      originalLikelihood: 4,
      originalConsequence: 3,
      likelihood: 4,
      consequence: 3,
      mitigationStrategy: "control",
      owner: "HR",
      status: "mitigating",
    },
  });
  for (let i = 0; i < 4; i++) {
    const el = 4 - i;
    const ec = 3;
    await prisma.mitigationStep.create({
      data: {
        riskId: d3.id,
        sequenceOrder: i,
        mitigationActions: `Retention initiative ${i + 1}: Compensation, development, engagement`,
        closureCriteria: `Turnover within target; pipeline established`,
        estimatedStartDate: addMonths(baseDate, i),
        estimatedEndDate: addMonths(baseDate, i + 1),
        expectedLikelihood: Math.max(1, el),
        expectedConsequence: ec,
        expectedRiskLevel: getNumericalRiskLevel(Math.max(1, el), ec),
      },
    });
  }

  const d4 = await prisma.risk.create({
    data: {
      organizationalUnitId: deptOperations.id,
      riskName: "Cyber security posture",
      riskLevel: getRiskLevel(3, 5),
      riskCondition: "Evolving threats; audit findings pending.",
      riskIf: "vulnerabilities are exploited or compliance gaps remain",
      riskThen: "operations could be compromised; reputational damage.",
      category: "technical",
      originalLikelihood: 3,
      originalConsequence: 5,
      likelihood: 3,
      consequence: 5,
      mitigationStrategy: "control",
      owner: "CISO",
      status: "mitigating",
    },
  });
  for (let i = 0; i < 4; i++) {
    const el = 3 - Math.floor(i / 2);
    const ec = 5 - i;
    await prisma.mitigationStep.create({
      data: {
        riskId: d4.id,
        sequenceOrder: i,
        mitigationActions: `Security hardening phase ${i + 1}`,
        closureCriteria: `Audit findings remediated; controls validated`,
        estimatedStartDate: addMonths(baseDate, i * 2),
        estimatedEndDate: addMonths(baseDate, (i + 1) * 2),
        expectedLikelihood: Math.max(1, el),
        expectedConsequence: Math.max(1, ec),
        expectedRiskLevel: getNumericalRiskLevel(Math.max(1, el), Math.max(1, ec)),
      },
    });
  }

  // d5–d8: no mitigation steps
  await prisma.risk.createMany({
    data: [
      { organizationalUnitId: deptOperations.id, riskName: "Budget variance", riskCondition: "Cost drivers uncertain.", riskIf: "actual costs exceed plan", riskThen: "funding shortfall may require scope cuts.", category: "cost", originalLikelihood: 3, originalConsequence: 4, likelihood: 3, consequence: 4, riskLevel: getRiskLevel(3, 4), mitigationStrategy: "control", owner: "Finance", status: "open" },
      { organizationalUnitId: deptOperations.id, riskName: "Contractor performance", riskCondition: "New contractor on critical path.", riskIf: "contractor underperforms", riskThen: "schedule and quality will be impacted.", category: "schedule", originalLikelihood: 2, originalConsequence: 4, likelihood: 2, consequence: 4, riskLevel: getRiskLevel(2, 4), mitigationStrategy: "transfer", owner: "PM", status: "open" },
      { organizationalUnitId: deptOperations.id, riskName: "Facility access", riskCondition: "Shared facility; access coordination complex.", riskIf: "access is denied when needed", riskThen: "testing and delivery will slip.", category: "schedule", originalLikelihood: 2, originalConsequence: 3, likelihood: 2, consequence: 3, riskLevel: getRiskLevel(2, 3), mitigationStrategy: "acceptance", owner: "Facilities", status: "open" },
      { organizationalUnitId: deptOperations.id, riskName: "Documentation backlog", riskCondition: "Technical documentation lags development.", riskIf: "documentation is not complete for handover", riskThen: "sustainment and training will be delayed.", category: "other", originalLikelihood: 4, originalConsequence: 2, likelihood: 4, consequence: 2, riskLevel: getRiskLevel(4, 2), mitigationStrategy: "control", owner: "Tech Writer", status: "open" },
    ],
  });

  await prisma.risk.create({
    data: {
      organizationalUnitId: programAlpha.id,
      riskName: "Subsystem integration uncertainty",
      riskCondition: "Subsystem interfaces are not fully defined; integration testing has been deferred.",
      riskIf: "interface defects or performance shortfalls are discovered during late integration",
      riskThen: "schedule will slip and rework will increase cost.",
      category: "technical",
      originalLikelihood: 3,
      originalConsequence: 4,
      likelihood: 3,
      consequence: 4,
      mitigationStrategy: "control",
      mitigationPlan: "Early integration testing; dedicated integration team",
      owner: "Systems Lead",
      status: "mitigating",
    },
  });

  await prisma.risk.create({
    data: {
      organizationalUnitId: programAlpha.id,
      riskName: "Supplier capacity constraints",
      riskCondition: "Single-source suppliers for critical components; limited visibility into supplier capacity.",
      riskIf: "a key supplier cannot meet quantity or date commitments",
      riskThen: "production will be delayed and program milestones missed.",
      category: "schedule",
      originalLikelihood: 2,
      originalConsequence: 3,
      likelihood: 2,
      consequence: 3,
      mitigationStrategy: "transfer",
      mitigationPlan: "Dual-source key suppliers; buffer in schedule",
      owner: "Supply Chain",
      status: "open",
    },
  });

  await prisma.risk.create({
    data: {
      organizationalUnitId: projectX.id,
      riskName: "Labor cost escalation",
      riskCondition: "Labor rates are rising and the program relies on specialized roles with limited availability.",
      riskIf: "labor cost escalation or retention issues continue",
      riskThen: "budget baseline will be exceeded and schedule may slip due to staffing gaps.",
      category: "cost",
      originalLikelihood: 4,
      originalConsequence: 3,
      likelihood: 4,
      consequence: 3,
      mitigationStrategy: "control",
      mitigationPlan: "Fixed-price subcontracts where feasible; cost tracking",
      owner: "PM",
      status: "open",
    },
  });

  // Backfill risk versions for all risks
  const allRisks = await prisma.risk.findMany();
  for (const risk of allRisks) {
    const count = await prisma.riskVersion.count({ where: { riskId: risk.id } });
    if (count === 0) {
      await prisma.riskVersion.create({
        data: {
          riskId: risk.id,
          version: 1,
          snapshot: {
            riskName: risk.riskName,
            riskCondition: risk.riskCondition,
            riskIf: risk.riskIf,
            riskThen: risk.riskThen,
            category: risk.category,
            likelihood: risk.likelihood,
            consequence: risk.consequence,
            riskLevel: risk.riskLevel,
            mitigationStrategy: risk.mitigationStrategy,
            mitigationPlan: risk.mitigationPlan,
            owner: risk.owner,
            status: risk.status,
          },
        },
      });
    }
  }

  console.log("Seed completed:");
  console.log("  Legal entities:", companyA.name, companyB.name);
  console.log("  Org units: Program Alpha, Project X, Engineering, Program Bravo, Operations");
  console.log("  Company B Program Bravo: 5 risks (4 with mitigation plans, 1 without)");
  console.log("  Company B Operations: 8 risks (1 with 7 steps, 3 with 4 steps, 4 without)");
  console.log("  Company A: 3 sample risks");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
