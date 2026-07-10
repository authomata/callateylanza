"use client";

import { STAGES, isApproved, type Availability } from "@/lib/pipeline";
import type { Deliverable } from "@/lib/types";

interface Props {
  items: Deliverable[];
  availability: Record<string, Availability>;
  selId: string;
  onSelect: (id: string) => void;
  nextTipo: string | null;
}

export function PipelineRail({ items, availability, selId, onSelect, nextTipo }: Props) {
  const byTipo = new Map(items.map((d) => [d.tipo, d]));
  const total = items.length;
  const aprobados = items.filter((d) => isApproved(d.estado)).length;

  return (
    <aside className="space-y-5">
      {STAGES.map((stage) => (
        <div key={stage.n} className="space-y-1.5">
          <div className="flex items-center gap-3 px-1">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="eyebrow whitespace-nowrap">
              Etapa {stage.n} · {stage.titulo}
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
          {stage.tipos.map((tipo) => {
            const d = byTipo.get(tipo);
            if (!d) return null;
            const done = isApproved(d.estado);
            const active = d.id === selId;
            const avail = availability[d.tipo]?.disponible ?? false;
            const locked = !avail && !done;
            const isNext = d.tipo === nextTipo;
            return (
              <StepRow
                key={d.id}
                code={d.tipo}
                titulo={d.titulo}
                done={done}
                active={active}
                locked={locked}
                isNext={isNext}
                onClick={() => onSelect(d.id)}
              />
            );
          })}
        </div>
      ))}

      <div className="rounded-xl border border-[var(--border-card)] bg-subtle p-3">
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-secondary">Progreso del kit</span>
          <span className="font-mono text-muted">{aprobados} / {total}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full rounded-full bg-brand" style={{ width: `${(aprobados / total) * 100}%` }} />
        </div>
      </div>
    </aside>
  );
}

function StepRow({
  code,
  titulo,
  done,
  active,
  locked,
  isNext,
  onClick,
}: {
  code: string;
  titulo: string;
  done: boolean;
  active: boolean;
  locked: boolean;
  isNext: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
        active
          ? "border border-[var(--border-card)] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          : "border border-transparent hover:bg-[color-mix(in_srgb,var(--border)_35%,transparent)]"
      } ${locked ? "opacity-50" : ""}`}
    >
      <Avatar code={code} done={done} active={active} locked={locked} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${done ? "text-secondary" : "text-foreground"}`}>
          {titulo}
        </span>
        {isNext && !active && (
          <span className="eyebrow" style={{ letterSpacing: "0.14em" }}>
            Siguiente
          </span>
        )}
      </span>
      {active && !done && <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />}
      {locked && <span className="shrink-0 text-xs">🔒</span>}
    </button>
  );
}

function Avatar({ code, done, active, locked }: { code: string; done: boolean; active: boolean; locked: boolean }) {
  if (done) {
    return (
      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[var(--ok)] text-[11px] text-white">
        ✓
      </span>
    );
  }
  if (active || (!locked && !done)) {
    return (
      <span
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[10px] ${
          active
            ? "bg-brand text-brand-fg"
            : "border border-[var(--muted-light)] text-muted"
        }`}
      >
        {code}
      </span>
    );
  }
  return (
    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-[var(--muted-light)] font-mono text-[10px] text-muted">
      {code}
    </span>
  );
}
