"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { isApproved, nextRecommended } from "@/lib/pipeline";
import type { DeliverableEstado, DeliverableTipo, ProjectEstado } from "@/lib/types";

export interface DashProject {
  id: string;
  clientName: string;
  kitName: string;
  ciudad: string | null;
  rubro: string | null;
  estado: ProjectEstado;
  deliverables: { tipo: DeliverableTipo; estado: DeliverableEstado; titulo: string; desbloqueo_manual: boolean }[];
}

type Filtro = "Todos" | "En progreso" | "En revisión" | "Entregados";

const GRUPO: Record<ProjectEstado, Exclude<Filtro, "Todos">> = {
  onboarding: "En progreso",
  en_produccion: "En progreso",
  en_revision: "En revisión",
  entregado: "Entregados",
  activo_seguimiento: "Entregados",
  cerrado: "Entregados",
};

const PILL: Record<Exclude<Filtro, "Todos">, { label: string; color: string }> = {
  "En progreso": { label: "En progreso", color: "#bc5b34" },
  "En revisión": { label: "En revisión", color: "#5a5147" },
  Entregados: { label: "Entregado", color: "#2e5e4e" },
};

export function DashboardGrid({ projects }: { projects: DashProject[] }) {
  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("Todos");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return projects.filter((p) => {
      if (filtro !== "Todos" && GRUPO[p.estado] !== filtro) return false;
      if (!needle) return true;
      return (
        p.clientName.toLowerCase().includes(needle) || p.kitName.toLowerCase().includes(needle)
      );
    });
  }, [projects, q, filtro]);

  const tabs: Filtro[] = ["Todos", "En progreso", "En revisión", "Entregados"];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="eyebrow">Taller · {projects.length} kits activos</div>
          <h1 className="mt-1 font-serif text-[32px] leading-none">Proyectos</h1>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar cliente o kit…"
            className="w-56 rounded-lg border border-[var(--border-card)] bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand"
          />
          <Link
            href="/projects/new"
            className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-brand-fg hover:brightness-105"
          >
            + Nuevo proyecto
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setFiltro(t)}
            className={`px-3 py-2 text-sm ${
              filtro === t ? "border-b-2 border-brand font-medium text-foreground" : "text-muted"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((p) => (
          <ProjectCard key={p.id} p={p} />
        ))}
        <Link
          href="/projects/new"
          className="grid min-h-[168px] place-items-center rounded-xl border border-dashed border-[var(--border-card)] text-center transition hover:bg-surface"
        >
          <div>
            <div className="text-2xl text-brand">+</div>
            <div className="mt-1 font-medium">Nuevo proyecto</div>
            <div className="text-xs text-muted">Empieza por la extracción (D0)</div>
          </div>
        </Link>
      </div>

      {filtered.length === 0 && (
        <p className="py-8 text-center text-muted">No hay proyectos que coincidan.</p>
      )}
    </div>
  );
}

function ProjectCard({ p }: { p: DashProject }) {
  const total = p.deliverables.length || 9;
  const aprobados = p.deliverables.filter((d) => isApproved(d.estado)).length;
  const next = nextRecommended(p.deliverables);
  const nextD = next ? p.deliverables.find((d) => d.tipo === next) : null;
  const foco = aprobados >= total ? "Kit completo" : nextD ? `${nextD.tipo} · ${nextD.titulo}` : "—";
  const pill = PILL[GRUPO[p.estado]];

  return (
    <Link
      href={`/projects/${p.id}`}
      className="flex flex-col justify-between rounded-xl border border-[var(--border-card)] bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <span className="font-serif text-xl">{p.clientName}</span>
          <span
            className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
            style={{ color: pill.color, backgroundColor: `color-mix(in srgb, ${pill.color} 14%, transparent)` }}
          >
            {pill.label}
          </span>
        </div>
        <div className="mt-0.5 font-mono text-xs text-muted">{p.kitName}</div>
        <div className="mt-2 text-sm text-secondary">
          {[p.ciudad, p.rubro].filter(Boolean).join(" · ") || "—"}
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-secondary">{foco}</span>
          <span className="font-mono text-muted">
            {aprobados} / {total}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-[var(--border)]">
          <div
            className={aprobados >= total ? "h-full rounded-full bg-[var(--ok)]" : "h-full rounded-full bg-brand"}
            style={{ width: `${(aprobados / total) * 100}%` }}
          />
        </div>
      </div>
    </Link>
  );
}
