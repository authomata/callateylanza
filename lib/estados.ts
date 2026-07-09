import type { DeliverableEstado, ProjectEstado } from "@/lib/types";

// Human labels + a semantic color token per state, shared across dashboard + project view.
export const DELIVERABLE_ESTADO: Record<DeliverableEstado, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#9a978f" },
  generando: { label: "Generando…", color: "#b5651d" },
  borrador: { label: "Borrador", color: "#7a7a7a" },
  en_edicion: { label: "En edición", color: "#3a72c4" },
  listo_para_revision: { label: "Listo para revisión", color: "#b5651d" },
  aprobado: { label: "Aprobado", color: "#1f6b4c" },
  publicado: { label: "Publicado", color: "#0f5132" },
  rechazado: { label: "Rechazado", color: "#b3261e" },
};

export const PROJECT_ESTADO: Record<ProjectEstado, string> = {
  onboarding: "Onboarding",
  en_produccion: "En producción",
  en_revision: "En revisión",
  entregado: "Entregado",
  activo_seguimiento: "Activo · seguimiento",
  cerrado: "Cerrado",
};

// The 8 client-facing deliverables (D0 is internal and not counted in the semáforo).
export const CLIENT_DELIVERABLES = ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"] as const;

// Days remaining until the "día 7" landing deadline (spec §5 D5).
export function daysUntil(dateISO: string | null): number | null {
  if (!dateISO) return null;
  const d = new Date(dateISO + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}
