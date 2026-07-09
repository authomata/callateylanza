import { findVoseo, type VoseoFinding } from "./voseo";
import type { DeliverableTipo } from "@/lib/types";

export interface ValidationReport {
  voseo: VoseoFinding[];
  length?: { chars: number; max: number; ok: boolean };
  anchors?: { ok: boolean; message: string }; // D2/D8 — stubbed for later phases
}

// Runs the validators applicable to a given module type (spec §7 post-generation).
export function runValidators(tipo: DeliverableTipo, text: string): ValidationReport {
  const report: ValidationReport = { voseo: findVoseo(text) };

  if (tipo === "D7") {
    const chars = text.length;
    report.length = { chars, max: 8000, ok: chars <= 8000 };
  }

  // TODO(Fase 2/3): anchor validator for D2/D8 — every pieza must have a non-empty Ancla
  // referencing a D0 story.
  return report;
}

// A deliverable may only be approved when it passes its hard validators.
export function isCleanForApproval(report: ValidationReport): boolean {
  if (report.voseo.length > 0) return false;
  if (report.length && !report.length.ok) return false;
  return true;
}

export { findVoseo, autoCorrectVoseo, hasVoseo } from "./voseo";
export type { VoseoFinding } from "./voseo";
