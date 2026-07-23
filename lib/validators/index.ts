import { findVoseo, type VoseoFinding } from "./voseo";
import { checkAnchors, type AnchorReport } from "./anchors";
import { findSlop, type SlopFinding } from "./slop";
import type { DeliverableTipo } from "@/lib/types";

export interface ValidationReport {
  voseo: VoseoFinding[];
  slop: SlopFinding[]; // andamiaje retórico / muletillas de IA
  length?: { chars: number; max: number; ok: boolean };
  anchors?: AnchorReport; // D2/D8
}

// Runs the validators applicable to a given module type (spec §7 post-generation).
export function runValidators(tipo: DeliverableTipo, text: string): ValidationReport {
  const report: ValidationReport = { voseo: findVoseo(text), slop: findSlop(text) };

  if (tipo === "D7") {
    const chars = text.length;
    report.length = { chars, max: 8000, ok: chars <= 8000 };
  }

  if (tipo === "D2" || tipo === "D8") {
    report.anchors = checkAnchors(text);
  }

  return report;
}

// A deliverable may only be approved when it passes its hard validators.
export function isCleanForApproval(report: ValidationReport): boolean {
  if (report.voseo.length > 0) return false;
  if (report.slop.length > 0) return false;
  if (report.length && !report.length.ok) return false;
  if (report.anchors && !report.anchors.ok) return false;
  return true;
}

export { findVoseo, autoCorrectVoseo, hasVoseo } from "./voseo";
export { checkAnchors } from "./anchors";
export { findSlop } from "./slop";
export type { VoseoFinding } from "./voseo";
export type { AnchorReport } from "./anchors";
export type { SlopFinding } from "./slop";
