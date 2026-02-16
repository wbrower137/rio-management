/**
 * RIO PowerPoint Report Generator
 * Loads the corporate .potx template, modifies OOXML, and outputs a .pptx.
 * Option A: JSZip + OOXML manipulation (no PptxGenJS).
 */

import JSZip from "jszip";
import type { Category, OpportunityCategory, Risk, Issue, Opportunity } from "../types";

interface MitigationStep {
  id: string;
  sequenceOrder: number;
  mitigationActions: string;
  closureCriteria?: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  expectedLikelihood: number;
  expectedConsequence: number;
  actualCompletedAt: string | null;
}
interface ResolutionStep {
  id: string;
  sequenceOrder: number;
  plannedAction: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  actualCompletedAt: string | null;
}
interface ActionPlanStep {
  id: string;
  sequenceOrder: number;
  plannedAction: string;
  estimatedStartDate: string | null;
  estimatedEndDate: string | null;
  actualCompletedAt: string | null;
}

// Risk level: (H), (M), (L)
const RISK_LEVEL_LABEL: Record<string, string> = { low: "(L)", moderate: "(M)", high: "(H)" };
const RISK_STATUS_LABEL: Record<string, string> = {
  open: "Open", mitigating: "Mitigating", accepted: "Accepted", closed: "Closed", realized: "Realized",
};
const ISSUE_STATUS_LABEL: Record<string, string> = { ignore: "Ignore", control: "Control" };
const OPP_LEVEL_LABEL: Record<string, string> = { low: "Good", moderate: "Very Good", high: "Excellent" };
const OPP_STATUS_LABEL: Record<string, string> = {
  pursue_now: "Pursue now", defer: "Defer", reevaluate: "Reevaluate", reject: "Reject",
};

const TEMPLATE_URL = "/RIOtemplate.potx";
const ITEMS_PER_SLIDE = 5;

/** Load template as ArrayBuffer for JSZip */
async function loadTemplate(): Promise<ArrayBuffer> {
  const url = `${TEMPLATE_URL}?t=${Date.now()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load template: ${res.status}`);
  return res.arrayBuffer();
}

/** Change Content_Types from template to presentation (for .pptx output) */
function toPresentationContentTypes(xml: string): string {
  return xml.replace(
    "presentationml.template.main+xml",
    "presentationml.presentation.main+xml"
  );
}

/** Replace title text in slide1.xml (centered title placeholder) */
function setSlide1Title(slideXml: string, title: string, subtitle: string): string {
  let out = slideXml;
  out = out.replace(/<a:t>RIO Management<\/a:t>/, `<a:t>${escapeXmlText(title)}</a:t>`);
  out = out.replace(/<a:t>Subtitle<\/a:t>/, `<a:t>${escapeXmlText(subtitle)}</a:t>`);
  return out;
}

function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Build a paragraph with text for OOXML txBody */
function paraWithText(text: string, lvl = 0): string {
  const escaped = escapeXmlText(text);
  return lvl > 0
    ? `<a:p><a:pPr lvl="${lvl}"/><a:r><a:rPr lang="en-US"/><a:t>${escaped}</a:t></a:r></a:p>`
    : `<a:p><a:r><a:rPr lang="en-US"/><a:t>${escaped}</a:t></a:r><a:endParaRPr lang="en-US"/></a:p>`;
}

/** Build bullet paragraph — buNone to disable layout bullet, then our own • in text */
function bullet(text: string): string {
  const escaped = escapeXmlText(`• ${text}`);
  return `<a:p><a:pPr><a:buNone/></a:pPr><a:r><a:rPr lang="en-US"/><a:t>${escaped}</a:t></a:r></a:p>`;
}

/** Build sub-bullet paragraph — buNone + lvl=1 indent, no layout bullet */
function subBullet(text: string): string {
  const escaped = escapeXmlText(text);
  return `<a:p><a:pPr lvl="1"><a:buNone/></a:pPr><a:r><a:rPr lang="en-US"/><a:t>${escaped}</a:t></a:r></a:p>`;
}

/** Bullet item: main bullet string or { sub: string } for sub-bullet */
type BulletItem = string | { sub: string };

/** Set title and bullet content on a Title+Content slide (slide2 format) */
function setTitleAndContentSlide(
  slideXml: string,
  title: string,
  bullets: BulletItem[]
): string {
  const titlePara = paraWithText(title);
  const contentParas = bullets
    .map((b) => (typeof b === "string" ? bullet(b) : subBullet(b.sub)))
    .join("");
  const emptyPara = "<a:p><a:endParaRPr lang=\"en-US\"/></a:p>";

  // Replace first occurrence (title placeholder)
  let out = slideXml.replace(emptyPara, titlePara);
  // Replace second occurrence (content placeholder)
  out = out.replace(emptyPara, contentParas + emptyPara);
  return out;
}

/** Create slide XML by cloning slide2 template and filling placeholders */
function createSlideFromTemplate(slide2Xml: string, title: string, bullets: BulletItem[]): string {
  return setTitleAndContentSlide(slide2Xml, title, bullets);
}

/** Create slide XML with title + embedded image. Returns { slideXml, slideRels, mediaPath, mediaContentType }. */
function createSlideWithImage(
  slide2Xml: string,
  title: string,
  imageDataUrl: string,
  mediaPath: string
): { slideXml: string; slideRels: string; mediaBase64: string } {
  // Parse data URL: data:image/png;base64,XXX
  const match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  const base64 = match ? match[1] : "";
  if (!base64) throw new Error("Invalid image data URL");

  const titlePara = paraWithText(title);
  const emptyPara = "<a:p><a:endParaRPr lang=\"en-US\"/></a:p>";

  // Replace title; remove content placeholder (we'll add pic instead)
  let slideXml = slide2Xml.replace(emptyPara, titlePara);

  // Insert picture shape before </p:spTree>
  // EMUs: 914400 = 1 inch. Position: x=360000, y=1600000, size: 9144000 x 5143500 (10" x 5.6")
  const picShape = `
<p:pic xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<p:nvPicPr><p:cNvPr id="100" name="Matrix"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
<p:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
<p:spPr><a:xfrm><a:off x="360000" y="1600000"/><a:ext cx="9144000" cy="5143500"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
</p:pic>`;
  slideXml = slideXml.replace("</p:spTree>", picShape + "\n</p:spTree>");

  const slideRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${mediaPath.split("/").pop()}"/>
</Relationships>`;

  return { slideXml, slideRels, mediaBase64: base64 };
}

/** Chunk array into groups of size */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function truncate(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  return s.slice(0, max - 3) + "...";
}

const API = "/api";

async function fetchMitigationSteps(riskId: string): Promise<MitigationStep[]> {
  try {
    const r = await fetch(`${API}/risks/${riskId}/mitigation-steps`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchResolutionSteps(issueId: string): Promise<ResolutionStep[]> {
  try {
    const r = await fetch(`${API}/issues/${issueId}/resolution-steps`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function fetchActionPlanSteps(oppId: string): Promise<ActionPlanStep[]> {
  try {
    const r = await fetch(`${API}/opportunities/${oppId}/action-plan-steps`);
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export interface RIOReportParams {
  entityName: string;
  orgUnitName: string;
  orgUnitType: string;
  risks: Risk[];
  issues: Issue[];
  opportunities: Opportunity[];
  categories: Category[];
  opportunityCategories: OpportunityCategory[];
  /** Optional: base64 data URLs for matrix/waterfall images to embed in report */
  images?: {
    riskMatrix?: string;
    issueMatrix?: string;
    oppMatrix?: string;
  };
}

/**
 * Generate a RIO PowerPoint report from the corporate template.
 * Returns a Blob ready for download.
 */
export async function generateRIOPowerPointReport(params: RIOReportParams): Promise<Blob> {
  const { entityName, orgUnitName, orgUnitType, risks, issues, opportunities, categories, opportunityCategories } = params;
  const categoryLabelMap: Record<string, string> = Object.fromEntries(categories.map((c) => [c.code, c.label]));
  const oppCategoryLabelMap: Record<string, string> = Object.fromEntries(opportunityCategories.map((c) => [c.code, c.label]));
  const dateStr = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const templateBuffer = await loadTemplate();
  const zip = await JSZip.loadAsync(templateBuffer);

  // --- Slide 1: Title ---
  const slide1Path = "ppt/slides/slide1.xml";
  const slide1Xml = await zip.file(slide1Path)?.async("string");
  if (!slide1Xml) throw new Error("Template missing slide1.xml");

  const title = "RIO Management Report";
  const subtitle = `${entityName} — ${orgUnitType} ${orgUnitName} • ${dateStr}`;
  zip.file(slide1Path, setSlide1Title(slide1Xml, title, subtitle));

  // --- Slide 2: Executive Summary ---
  const slide2Path = "ppt/slides/slide2.xml";
  const slide2Xml = await zip.file(slide2Path)?.async("string");
  if (!slide2Xml) throw new Error("Template missing slide2.xml");

  const riskCount = risks.length;
  const issueCount = issues.length;
  const oppCount = opportunities.length;
  const highRisks = risks.filter((r) => r.riskLevel === "high").length;
  const openRisks = risks.filter((r) => !["closed", "accepted", "realized"].includes(r.status ?? "")).length;

  const execSummaryBullets = [
    `Scope: ${entityName} — ${orgUnitType} ${orgUnitName}`,
    `${riskCount} Risk${riskCount !== 1 ? "s" : ""} (${openRisks} open, ${highRisks} (H))`,
    `${issueCount} Issue${issueCount !== 1 ? "s" : ""}`,
    `${oppCount} Opportunit${oppCount !== 1 ? "ies" : "y"}`,
    `Report date: ${dateStr}`,
  ];
  zip.file(slide2Path, setTitleAndContentSlide(slide2Xml, "Executive Summary", execSummaryBullets));

  // --- Slides 3+ : Register overviews (5 per slide, add slides as needed) ---
  const slideLayoutRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout2.xml"/>
</Relationships>`;

  type ContentSlide = { title: string; bullets: BulletItem[] } | { title: string; imageDataUrl: string };

  const toRiskBullets = (rs: Risk[]): BulletItem[] =>
    rs.length === 0
      ? ["No risks in this scope."]
      : rs.flatMap((r) => {
          const name = (r.riskName ?? "Risk").slice(0, 50);
          const lc = `L${r.likelihood}xC${r.consequence}`;
          const level = RISK_LEVEL_LABEL[r.riskLevel ?? ""] ?? r.riskLevel ?? "—";
          const status = RISK_STATUS_LABEL[r.status ?? ""] ?? r.status ?? "—";
          const cat = r.category ? (categoryLabelMap[r.category] ?? r.category) : "—";
          return [name, { sub: `${lc} ${level} — ${cat} — ${status}` }];
        });

  const toIssueBullets = (iss: Issue[]): BulletItem[] =>
    iss.length === 0
      ? ["No issues in this scope."]
      : iss.flatMap((i) => {
          const name = (i.issueName ?? "Issue").slice(0, 50);
          const c = i.consequence;
          const status = ISSUE_STATUS_LABEL[i.status ?? ""] ?? i.status ?? "—";
          const cat = i.category ? (categoryLabelMap[i.category] ?? i.category) : "—";
          return [name, { sub: `C${c} — ${cat} — ${status}` }];
        });

  const toOppBullets = (opps: Opportunity[]): BulletItem[] =>
    opps.length === 0
      ? ["No opportunities in this scope."]
      : opps.flatMap((o) => {
          const name = (o.opportunityName ?? "Opportunity").slice(0, 50);
          const li = `L${o.likelihood}xI${o.impact}`;
          const level = OPP_LEVEL_LABEL[o.opportunityLevel ?? ""] ?? o.opportunityLevel ?? "—";
          const status = OPP_STATUS_LABEL[o.status ?? ""] ?? o.status ?? "—";
          const cat = o.category ? (oppCategoryLabelMap[o.category] ?? o.category) : "—";
          return [name, { sub: `${li} (${level}) — ${cat} — ${status}` }];
        });

  // Fetch step data for deep dives (in parallel)
  const [riskStepsMap, issueStepsMap, oppStepsMap] = await Promise.all([
    Promise.all(risks.map(async (r) => [r.id, await fetchMitigationSteps(r.id)] as const)).then(
      (pairs) => new Map(pairs)
    ),
    Promise.all(issues.map(async (i) => [i.id, await fetchResolutionSteps(i.id)] as const)).then(
      (pairs) => new Map(pairs)
    ),
    Promise.all(opportunities.map(async (o) => [o.id, await fetchActionPlanSteps(o.id)] as const)).then(
      (pairs) => new Map(pairs)
    ),
  ]);

  const formatDate = (s: string | null) => (s ? s.slice(0, 10) : "—");

  const toRiskDeepDiveBullets = (r: Risk, steps: MitigationStep[]): BulletItem[] => {
    const lc = `L${r.likelihood}xC${r.consequence}`;
    const level = RISK_LEVEL_LABEL[r.riskLevel ?? ""] ?? r.riskLevel ?? "—";
    const status = RISK_STATUS_LABEL[r.status ?? ""] ?? r.status ?? "—";
    const cat = r.category ? (categoryLabelMap[r.category] ?? r.category) : "—";
    const items: BulletItem[] = [
      `${lc} ${level} — ${cat} — ${status}${r.owner ? ` — Owner: ${r.owner}` : ""}`,
      { sub: `Condition: ${truncate(r.riskCondition ?? "", 200)}` },
      { sub: `If/Then: ${truncate((r.riskIf ?? "") + " → " + (r.riskThen ?? ""), 200)}` },
    ];
    if (r.mitigationStrategy) items.push({ sub: `Strategy: ${r.mitigationStrategy}` });
    if (r.mitigationPlan) items.push({ sub: `Plan: ${truncate(r.mitigationPlan, 180)}` });
    if (steps.length > 0) {
      items.push("Mitigation steps:");
      steps.forEach((st, i) => {
        const dates = st.estimatedStartDate || st.estimatedEndDate
          ? ` (${formatDate(st.estimatedStartDate)}–${formatDate(st.estimatedEndDate)})`
          : "";
        const done = st.actualCompletedAt ? " ✓" : "";
        items.push({ sub: `${i + 1}. ${truncate(st.mitigationActions, 120)}${dates}${done}` });
      });
    }
    return items;
  };

  const toIssueDeepDiveBullets = (i: Issue, steps: ResolutionStep[]): BulletItem[] => {
    const c = i.consequence;
    const status = ISSUE_STATUS_LABEL[i.status ?? ""] ?? i.status ?? "—";
    const cat = i.category ? (categoryLabelMap[i.category] ?? i.category) : "—";
    const items: BulletItem[] = [
      `C${c} — ${cat} — ${status}${i.owner ? ` — Owner: ${i.owner}` : ""}`,
      { sub: truncate(i.description ?? "No description.", 250) },
    ];
    if (steps.length > 0) {
      items.push("Resolution steps:");
      steps.forEach((st, idx) => {
        const dates = st.estimatedStartDate || st.estimatedEndDate
          ? ` (${formatDate(st.estimatedStartDate)}–${formatDate(st.estimatedEndDate)})`
          : "";
        const done = st.actualCompletedAt ? " ✓" : "";
        items.push({ sub: `${idx + 1}. ${truncate(st.plannedAction, 120)}${dates}${done}` });
      });
    }
    return items;
  };

  const toOppDeepDiveBullets = (o: Opportunity, steps: ActionPlanStep[]): BulletItem[] => {
    const li = `L${o.likelihood}xI${o.impact}`;
    const level = OPP_LEVEL_LABEL[o.opportunityLevel ?? ""] ?? o.opportunityLevel ?? "—";
    const status = OPP_STATUS_LABEL[o.status ?? ""] ?? o.status ?? "—";
    const cat = o.category ? (oppCategoryLabelMap[o.category] ?? o.category) : "—";
    const items: BulletItem[] = [
      `${li} (${level}) — ${cat} — ${status}${o.owner ? ` — Owner: ${o.owner}` : ""}`,
      { sub: `Condition: ${truncate(o.opportunityCondition ?? "", 200)}` },
      { sub: `If/Then: ${truncate((o.opportunityIf ?? "") + " → " + (o.opportunityThen ?? ""), 200)}` },
    ];
    if (steps.length > 0) {
      items.push("Action plan steps:");
      steps.forEach((st, idx) => {
        const dates = st.estimatedStartDate || st.estimatedEndDate
          ? ` (${formatDate(st.estimatedStartDate)}–${formatDate(st.estimatedEndDate)})`
          : "";
        const done = st.actualCompletedAt ? " ✓" : "";
        items.push({ sub: `${idx + 1}. ${truncate(st.plannedAction, 120)}${dates}${done}` });
      });
    }
    return items;
  };

  const contentSlides: ContentSlide[] = [];

  // Risk Register Overview
  const riskChunks = risks.length === 0 ? [[]] : chunk(risks, ITEMS_PER_SLIDE);
  const riskTotal = riskChunks.length;
  riskChunks.forEach((rs, i) => {
    const t = riskTotal > 1 ? `Risk Register Overview (${i + 1} of ${riskTotal})` : "Risk Register Overview";
    contentSlides.push({ title: t, bullets: toRiskBullets(rs) });
  });

  // Risks section transition + optional matrix + deep dives
  contentSlides.push({ title: "Risks", bullets: ["Deep dive into each risk."] });
  if (params.images?.riskMatrix) {
    contentSlides.push({ title: "5×5 Risk Matrix", imageDataUrl: params.images.riskMatrix });
  }
  risks.forEach((r) => {
    const steps = riskStepsMap.get(r.id) ?? [];
    contentSlides.push({
      title: truncate(r.riskName ?? "Risk", 80),
      bullets: toRiskDeepDiveBullets(r, steps),
    });
  });

  // Issue Register Overview
  const issueChunks = issues.length === 0 ? [[]] : chunk(issues, ITEMS_PER_SLIDE);
  const issueTotal = issueChunks.length;
  issueChunks.forEach((iss, i) => {
    const t = issueTotal > 1 ? `Issue Register Overview (${i + 1} of ${issueTotal})` : "Issue Register Overview";
    contentSlides.push({ title: t, bullets: toIssueBullets(iss) });
  });

  // Issues section transition + optional matrix + deep dives
  contentSlides.push({ title: "Issues", bullets: ["Deep dive into each issue."] });
  if (params.images?.issueMatrix) {
    contentSlides.push({ title: "5×5 Issue Matrix", imageDataUrl: params.images.issueMatrix });
  }
  issues.forEach((i) => {
    const steps = issueStepsMap.get(i.id) ?? [];
    contentSlides.push({
      title: truncate(i.issueName ?? "Issue", 80),
      bullets: toIssueDeepDiveBullets(i, steps),
    });
  });

  // Opp Register Overview
  const oppChunks = opportunities.length === 0 ? [[]] : chunk(opportunities, ITEMS_PER_SLIDE);
  const oppTotal = oppChunks.length;
  oppChunks.forEach((opps, i) => {
    const t = oppTotal > 1 ? `Opportunity Register Overview (${i + 1} of ${oppTotal})` : "Opportunity Register Overview";
    contentSlides.push({ title: t, bullets: toOppBullets(opps) });
  });

  // Opportunities section transition + optional matrix + deep dives
  contentSlides.push({ title: "Opportunities", bullets: ["Deep dive into each opportunity."] });
  if (params.images?.oppMatrix) {
    contentSlides.push({ title: "5×5 Opportunity Matrix", imageDataUrl: params.images.oppMatrix });
  }
  opportunities.forEach((o) => {
    const steps = oppStepsMap.get(o.id) ?? [];
    contentSlides.push({
      title: truncate(o.opportunityName ?? "Opportunity", 80),
      bullets: toOppDeepDiveBullets(o, steps),
    });
  });

  // Create slide files and collect rels + sldIds
  let slideNum = 3;
  let imageIndex = 0;
  const slideOverrideParts: string[] = [];
  const relParts: string[] = [];
  const sldIdParts: string[] = [];
  let sldId = 258;

  for (const slide of contentSlides) {
    const rId = `rId${slideNum + 5}`;
    if ("imageDataUrl" in slide && slide.imageDataUrl) {
      imageIndex++;
      const mediaPath = `media/rio_report_${imageIndex}.png`;
      const { slideXml, slideRels, mediaBase64 } = createSlideWithImage(
        slide2Xml,
        slide.title,
        slide.imageDataUrl,
        `ppt/${mediaPath}`
      );
      const binary = Uint8Array.from(atob(mediaBase64), (c) => c.charCodeAt(0));
      zip.file(`ppt/${mediaPath}`, binary, { binary: true });
      zip.file(`ppt/slides/slide${slideNum}.xml`, slideXml);
      zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, slideRels);
    } else {
      const { title, bullets } = slide;
      zip.file(`ppt/slides/slide${slideNum}.xml`, createSlideFromTemplate(slide2Xml, title, bullets));
      zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`, slideLayoutRels);
    }
    slideOverrideParts.push(`<Override PartName="/ppt/slides/slide${slideNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`);
    relParts.push(`<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slideNum}.xml"/>`);
    sldIdParts.push(`<p:sldId id="${sldId}" r:id="${rId}"/>`);
    slideNum++;
    sldId++;
  }

  // Update presentation.xml.rels
  const presRelsPath = "ppt/_rels/presentation.xml.rels";
  const presRels = await zip.file(presRelsPath)?.async("string");
  if (!presRels) throw new Error("Template missing presentation.xml.rels");
  zip.file(presRelsPath, presRels.replace("</Relationships>", relParts.join("") + "</Relationships>"));

  // Update presentation.xml
  const presPath = "ppt/presentation.xml";
  const presXml = await zip.file(presPath)?.async("string");
  if (!presXml) throw new Error("Template missing presentation.xml");
  zip.file(presPath, presXml.replace("</p:sldIdLst>", sldIdParts.join("") + "</p:sldIdLst>"));

  // Update [Content_Types].xml
  const contentTypesPath = "[Content_Types].xml";
  let contentTypesXml = await zip.file(contentTypesPath)?.async("string");
  if (contentTypesXml) {
    contentTypesXml = toPresentationContentTypes(contentTypesXml);
    const slideOverride =
      'ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"';
    contentTypesXml = contentTypesXml.replace(
      `PartName="/ppt/slides/slide2.xml" ${slideOverride}/>`,
      `PartName="/ppt/slides/slide2.xml" ${slideOverride}/>${slideOverrideParts.join("")}`
    );
    if (imageIndex > 0 && !contentTypesXml.includes('Extension="png"')) {
      contentTypesXml = contentTypesXml.replace(
        /<Types[^>]*>/,
        (m) => `${m}<Default Extension="png" ContentType="image/png"/>`
      );
    }
    zip.file(contentTypesPath, contentTypesXml);
  }

  // --- View: open in normal slide view ---
  const viewPropsPath = "ppt/viewProps.xml";
  const viewPropsXml = await zip.file(viewPropsPath)?.async("string");
  if (viewPropsXml) {
    zip.file(viewPropsPath, viewPropsXml.replace('lastView="sldMasterView"', 'lastView="sldView"'));
  }

  const blob = await zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  });

  return blob;
}

/** Trigger download of a Blob as a .pptx file */
export function downloadPptx(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".pptx") ? filename : `${filename}.pptx`;
  a.click();
  URL.revokeObjectURL(url);
}
