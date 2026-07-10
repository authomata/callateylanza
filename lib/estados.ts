import type { DeliverableEstado, ProjectEstado } from "@/lib/types";

// Human labels + a semantic color token per state, shared across dashboard + project view.
export const DELIVERABLE_ESTADO: Record<DeliverableEstado, { label: string; color: string }> = {
  pendiente: { label: "Pendiente", color: "#a79c8d" },
  generando: { label: "Generando…", color: "#bc5b34" },
  borrador: { label: "Borrador", color: "#8c837a" },
  en_edicion: { label: "En edición", color: "#5a5147" },
  listo_para_revision: { label: "Listo para revisión", color: "#bc5b34" },
  aprobado: { label: "Aprobado", color: "#2e5e4e" },
  publicado: { label: "Publicado", color: "#2e5e4e" },
  rechazado: { label: "Rechazado", color: "#a6321f" },
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
