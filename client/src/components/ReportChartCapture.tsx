/**
 * Renders Risk, Issue, and Opportunity matrices off-screen for report capture.
 * Used when generating PowerPoint to capture 5×5 matrix images.
 */
import { useEffect, useRef, useState } from "react";
import type { Category, Issue, Opportunity, OpportunityCategory, OrganizationalUnit, Risk } from "../types";
import { captureElementAsPngDataUrlCropped } from "../utils/exportPng";
import { RiskMatrix } from "./RiskMatrix";
import { IssueMatrix } from "./IssueMatrix";
import { OpportunityMatrix } from "./OpportunityMatrix";

interface ReportChartCaptureProps {
  orgUnit: OrganizationalUnit;
  risks: Risk[];
  issues: Issue[];
  opportunities: Opportunity[];
  categories: Category[];
  opportunityCategories: OpportunityCategory[];
  onCaptureComplete: (images: {
    riskMatrix?: string;
    issueMatrix?: string;
    oppMatrix?: string;
  }) => void;
}

export function ReportChartCapture({
  orgUnit,
  risks,
  issues,
  opportunities,
  categories,
  opportunityCategories,
  onCaptureComplete,
}: ReportChartCaptureProps) {
  const riskRef = useRef<HTMLDivElement | null>(null);
  const issueRef = useRef<HTMLDivElement | null>(null);
  const oppRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 150);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const capture = async () => {
      const images: { riskMatrix?: string; issueMatrix?: string; oppMatrix?: string } = {};
      try {
        if (riskRef.current) images.riskMatrix = await captureElementAsPngDataUrlCropped(riskRef.current);
        if (issueRef.current) images.issueMatrix = await captureElementAsPngDataUrlCropped(issueRef.current);
        if (oppRef.current) images.oppMatrix = await captureElementAsPngDataUrlCropped(oppRef.current);
      } catch (e) {
        console.error("Report chart capture failed:", e);
      }
      onCaptureComplete(images);
    };
    capture();
  }, [ready, onCaptureComplete]);

  return (
    <div
      style={{
        position: "fixed",
        left: -99999,
        top: 0,
        width: 1920,
        height: 1080,
        overflow: "hidden",
        background: "white",
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <div style={{ position: "absolute", left: 0, top: 0 }}>
        <RiskMatrix categories={categories} orgUnit={orgUnit} risks={risks} onExportRef={(el) => { riskRef.current = el; }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 1080 }}>
        <IssueMatrix categories={categories} orgUnit={orgUnit} issues={issues} onExportRef={(el) => { issueRef.current = el; }} />
      </div>
      <div style={{ position: "absolute", left: 0, top: 2160 }}>
        <OpportunityMatrix
          categories={opportunityCategories}
          orgUnit={orgUnit}
          opportunities={opportunities}
          onExportRef={(el) => { oppRef.current = el; }}
        />
      </div>
    </div>
  );
}
