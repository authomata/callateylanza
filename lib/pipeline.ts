import type { Deliverable, DeliverableEstado, DeliverableTipo } from "@/lib/types";

// ── El camino: dependencias (DAG) y etapas ──────────────────────────────────
// Un entregable se habilita cuando TODOS sus insumos requeridos están aprobados.
// Fuente única para el gate de generación y para el "camino" de la UI.
// (module_templates.inputs_requeridos se mantiene en sync con esto para la generación.)
export const DEPS: Record<DeliverableTipo, DeliverableTipo[]> = {
  D0: [],
  D1: ["D0"],
  D3: ["D1"],
  D6: ["D1"],
  D4: ["D1", "D3"],
  D5: ["D1", "D3", "D6"],
  D2: ["D1", "D3", "D4"], // el Plan de Medios integra oferta + lead magnet
  D8: ["D1", "D2"],
  D7: ["D1", "D2", "D3"],
};

export interface Stage {
  n: number;
  titulo: string;
  tipos: DeliverableTipo[];
}

export const STAGES: Stage[] = [
  { n: 0, titulo: "Materia prima", tipos: ["D0"] },
  { n: 1, titulo: "Fundamento", tipos: ["D1"] },
  { n: 2, titulo: "Oferta & activos", tipos: ["D3", "D6"] },
  { n: 3, titulo: "Conversión", tipos: ["D4", "D5"] },
  { n: 4, titulo: "Motor de contenido", tipos: ["D2", "D8", "D7"] },
];

const APPROVED = new Set<DeliverableEstado>(["aprobado", "publicado"]);
export function isApproved(estado: DeliverableEstado): boolean {
  return APPROVED.has(estado);
}

export interface Availability {
  disponible: boolean;
  faltan: DeliverableTipo[]; // insumos requeridos aún no aprobados
}

type Dep = Pick<Deliverable, "tipo" | "estado" | "desbloqueo_manual">;

// Disponibilidad por entregable. desbloqueo_manual (admin) salta la regla.
export function computeAvailability(deliverables: Dep[]): Record<string, Availability> {
  const byTipo = new Map(deliverables.map((d) => [d.tipo, d]));
  const out: Record<string, Availability> = {};
  for (const d of deliverables) {
    if (d.desbloqueo_manual) {
      out[d.tipo] = { disponible: true, faltan: [] };
      continue;
    }
    const faltan = (DEPS[d.tipo] ?? []).filter((dep) => {
      const depD = byTipo.get(dep);
      return !depD || !isApproved(depD.estado);
    });
    out[d.tipo] = { disponible: faltan.length === 0, faltan };
  }
  return out;
}

// El siguiente paso recomendado: primer entregable no aprobado, en orden de etapa, ya disponible.
export function nextRecommended(deliverables: Dep[]): DeliverableTipo | null {
  const avail = computeAvailability(deliverables);
  const byTipo = new Map(deliverables.map((d) => [d.tipo, d]));
  for (const stage of STAGES) {
    for (const tipo of stage.tipos) {
      const d = byTipo.get(tipo);
      if (d && !isApproved(d.estado) && avail[tipo]?.disponible) return tipo;
    }
  }
  return null;
}
