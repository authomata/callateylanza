"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge, Button } from "@/components/ui";
import { DELIVERABLE_ESTADO } from "@/lib/estados";
import { findVoseo, autoCorrectVoseo } from "@/lib/validators/voseo";
import type { Deliverable, InputRow, ModuleTemplate, UserRol, VoiceDoc } from "@/lib/types";
import {
  updateDeliverableContent,
  saveDeliverableVersion,
  setDeliverableEstado,
  getVersions,
  restoreVersion,
} from "../actions";
import InsumosPanel from "./insumos";

type TemplateInfo = Pick<ModuleTemplate, "tipo" | "version" | "inputs_requeridos" | "checklist_calidad" | "activa">;

interface Props {
  projectId: string;
  userRol: UserRol;
  deliverables: Deliverable[];
  inputs: InputRow[];
  voiceDoc: VoiceDoc | null;
  templates: TemplateInfo[];
}

export default function ProjectWorkspace({ projectId, userRol, deliverables, inputs, voiceDoc, templates }: Props) {
  const router = useRouter();
  const [items, setItems] = useState<Deliverable[]>(deliverables);
  const [selId, setSelId] = useState<string>(
    () => deliverables.find((d) => d.tipo === "D1")?.id ?? deliverables[0]?.id ?? ""
  );
  const selected = items.find((d) => d.id === selId) ?? null;

  // editor buffer
  const [buffer, setBuffer] = useState<string>(selected?.contenido_md ?? "");
  const [tab, setTab] = useState<"editar" | "vista">("editar");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // generation / instructions
  const [instrucciones, setInstrucciones] = useState("");
  const [generating, setGenerating] = useState(false);

  // per-action lock + transient confirmation (prevents double-click duplicates)
  const [busy, setBusy] = useState<null | "listo" | "approve" | "save">(null);
  const [flash, setFlash] = useState<string | null>(null);
  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2600);
  }

  // reset the editor buffer when the selected deliverable changes (React-recommended
  // "adjust state during render" pattern instead of a setState-in-effect)
  const [prevSel, setPrevSel] = useState(selId);
  if (selId !== prevSel) {
    setPrevSel(selId);
    setBuffer(selected?.contenido_md ?? "");
    setTab("editar");
  }

  const template = templates.find((t) => t.tipo === selected?.tipo);
  const voseo = useMemo(() => findVoseo(buffer), [buffer]);

  const patchItem = useCallback((id: string, patch: Partial<Deliverable>) => {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

  // debounced autosave (content only, no version snapshot)
  function onEdit(v: string) {
    setBuffer(v);
    setSaving("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await updateDeliverableContent(selId, v);
      patchItem(selId, { contenido_md: v, estado: selected?.estado === "aprobado" ? "aprobado" : "en_edicion" });
      setSaving("saved");
      setTimeout(() => setSaving("idle"), 1200);
    }, 1200);
  }

  async function snapshot() {
    if (busy) return;
    setBusy("save");
    try {
      await saveDeliverableVersion(selId, buffer, "humano");
      patchItem(selId, { contenido_md: buffer });
      setSaving("saved");
      showFlash("Versión guardada ✓");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function generate() {
    if (!selected) return;
    setGenerating(true);
    setTab("editar");
    setBuffer("");
    patchItem(selId, { estado: "generando" });
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deliverableId: selId, instrucciones }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Error de generación" }));
        alert(err.error ?? "Error de generación");
        patchItem(selId, { estado: selected.estado });
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setBuffer(acc);
      }
      patchItem(selId, { contenido_md: acc, estado: "borrador" });
      setInstrucciones("");
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function marcarListo() {
    if (busy) return;
    if (voseo.length > 0) {
      alert("Hay formas de voseo sin corregir. Corrígelas antes de marcar listo para revisión.");
      return;
    }
    setBusy("listo");
    try {
      await setDeliverableEstado(selId, "listo_para_revision");
      patchItem(selId, { estado: "listo_para_revision" });
      showFlash("Marcado listo para revisión ✓");
    } finally {
      setBusy(null);
    }
  }

  async function approve() {
    if (busy) return;
    setBusy("approve");
    try {
      const res = await fetch(`/api/deliverables/${selId}/approve`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "No se pudo aprobar");
        return;
      }
      patchItem(selId, { estado: "aprobado" });
      showFlash(data.unlocked ? "Aprobado ✓ — D2–D8 desbloqueados" : "Aprobado ✓");
      // D1 approval unlocks D2–D8; pull fresh gate state
      router.refresh();
      setItems((prev) =>
        prev.map((d) => (data.unlocked && d.tipo !== "D0" && d.tipo !== "D1" ? { ...d, gate_bloqueado: false } : d))
      );
    } finally {
      setBusy(null);
    }
  }

  function applyAutocorrect() {
    const fixed = autoCorrectVoseo(buffer);
    onEdit(fixed);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_320px]">
      {/* LEFT — checklist */}
      <aside className="space-y-1">
        <div className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">Entregables</div>
        {items.map((d) => {
          const est = DELIVERABLE_ESTADO[d.estado];
          const locked = d.gate_bloqueado && d.estado === "pendiente";
          return (
            <button
              key={d.id}
              onClick={() => setSelId(d.id)}
              className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-sm transition ${
                d.id === selId ? "border-brand bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]" : "border-border bg-surface hover:bg-[color-mix(in_srgb,var(--border)_30%,transparent)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted">{d.tipo}</span>
                <span className="truncate">{d.titulo}</span>
              </span>
              {locked ? (
                <span title="Bloqueado hasta aprobar D1" className="text-muted">🔒</span>
              ) : (
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: est.color }} />
              )}
            </button>
          );
        })}
      </aside>

      {/* CENTER — editor */}
      <section className="min-w-0 space-y-3">
        {!selected ? (
          <p className="text-muted">Selecciona un entregable.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-muted">{selected.tipo}</span>
                <h2 className="text-lg font-semibold">{selected.titulo}</h2>
                <Badge label={DELIVERABLE_ESTADO[selected.estado].label} color={DELIVERABLE_ESTADO[selected.estado].color} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                {saving === "saving" && <span>Guardando…</span>}
                {saving === "saved" && <span>Guardado ✓</span>}
                <span>v{selected.version_actual}</span>
              </div>
            </div>

            {flash && (
              <div className="rounded-md border border-brand bg-[color-mix(in_srgb,var(--brand)_12%,transparent)] px-3 py-2 text-sm font-medium text-brand">
                {flash}
              </div>
            )}

            <GateOrControls
              selected={selected}
              generating={generating}
              instrucciones={instrucciones}
              setInstrucciones={setInstrucciones}
              onGenerate={generate}
            />

            {/* editor tabs */}
            <div className="flex items-center gap-1 border-b border-border">
              {(["editar", "vista"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm capitalize ${
                    tab === t ? "border-b-2 border-brand font-medium" : "text-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 py-1">
                <VersionHistory deliverableId={selId} onRestore={async (vid) => { await restoreVersion(selId, vid); router.refresh(); const d = items.find(i=>i.id===selId); if(d){setBuffer(d.contenido_md ?? "");} }} />
                <Button variant="secondary" onClick={snapshot} disabled={generating || busy !== null}>
                  {busy === "save" ? "Guardando…" : "Guardar versión"}
                </Button>
              </div>
            </div>

            {tab === "editar" ? (
              <textarea
                value={buffer}
                onChange={(e) => onEdit(e.target.value)}
                disabled={generating}
                placeholder={generating ? "Generando…" : "El contenido generado aparecerá aquí. También puedes escribir directamente."}
                className="h-[52vh] w-full resize-y rounded-md border border-border bg-surface p-4 font-mono text-sm leading-relaxed outline-none focus:border-brand"
              />
            ) : (
              <div className="prose h-[52vh] overflow-auto rounded-md border border-border bg-surface p-6">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{buffer || "*Sin contenido.*"}</ReactMarkdown>
              </div>
            )}

            {/* voseo validator */}
            <VoseoPanel findings={voseo} onFixAll={applyAutocorrect} />

            {/* checklist de calidad */}
            {template && template.checklist_calidad?.length > 0 && (
              <Checklist items={template.checklist_calidad} />
            )}

            {/* actions */}
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
              {selected.estado !== "aprobado" && selected.estado !== "publicado" && (
                <Button
                  variant="secondary"
                  onClick={marcarListo}
                  disabled={generating || busy !== null || !buffer.trim()}
                >
                  {busy === "listo" ? "Guardando…" : "Marcar listo para revisión"}
                </Button>
              )}
              {userRol === "admin" && selected.estado === "listo_para_revision" && (
                <Button variant="primary" onClick={approve} disabled={busy !== null}>
                  {busy === "approve"
                    ? "Aprobando…"
                    : `Aprobar${selected.tipo === "D1" ? " (desbloquea D2–D8)" : ""}`}
                </Button>
              )}
              <a href={`/print/${selId}`} target="_blank" className="ml-auto text-sm text-brand hover:underline">
                Exportar PDF ↗
              </a>
            </div>
          </>
        )}
      </section>

      {/* RIGHT — insumos + voz */}
      <InsumosPanel projectId={projectId} inputs={inputs} voiceDoc={voiceDoc} />
    </div>
  );
}

function GateOrControls({
  selected,
  generating,
  instrucciones,
  setInstrucciones,
  onGenerate,
}: {
  selected: Deliverable;
  generating: boolean;
  instrucciones: string;
  setInstrucciones: (v: string) => void;
  onGenerate: () => void;
}) {
  const locked = selected.gate_bloqueado && selected.estado === "pendiente";
  if (locked) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface p-3 text-sm text-muted">
        🔒 Bloqueado. Aprueba el <strong>Manual Maestro (D1)</strong> para habilitar este entregable.
      </div>
    );
  }
  const isRegen = !!selected.contenido_md;
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <textarea
        value={instrucciones}
        onChange={(e) => setInstrucciones(e.target.value)}
        placeholder="Instrucciones adicionales (opcional): 'hazlo más filoso', 'usa la historia del avión'…"
        className="mb-2 h-16 w-full resize-none rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-brand"
      />
      <Button variant="primary" onClick={onGenerate} disabled={generating}>
        {generating ? "Generando…" : isRegen ? "Regenerar" : "Generar"}
      </Button>
    </div>
  );
}

function VoseoPanel({ findings, onFixAll }: { findings: { line: number; match: string; suggestion: string }[]; onFixAll: () => void }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs text-[var(--ok,#1f6b4c)]">
        ✓ Sin voseo detectado — español de Chile.
      </div>
    );
  }
  return (
    <div className="rounded-md border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--danger)]">
          {findings.length} forma(s) de voseo detectada(s)
        </span>
        <Button variant="danger" onClick={onFixAll}>Corregir todo</Button>
      </div>
      <ul className="max-h-24 space-y-0.5 overflow-auto text-xs text-muted">
        {findings.slice(0, 20).map((f, i) => (
          <li key={i}>
            línea {f.line}: <span className="font-mono text-[var(--danger)]">{f.match}</span> → <span className="font-mono">{f.suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  return (
    <details className="rounded-md border border-border bg-surface p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        Checklist de calidad ({checked.filter(Boolean).length}/{items.length})
      </summary>
      <ul className="mt-2 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
              className="mt-1"
            />
            <span className={checked[i] ? "text-muted line-through" : ""}>{it}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function VersionHistory({ deliverableId, onRestore }: { deliverableId: string; onRestore: (versionId: string) => void }) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<{ id: string; version: number; generado_por: string; created_at: string }[] | null>(null);

  async function toggle() {
    if (!open) setVersions((await getVersions(deliverableId)) as typeof versions);
    setOpen(!open);
  }

  return (
    <div className="relative">
      <Button variant="ghost" onClick={toggle}>Historial</Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-md border border-border bg-surface p-2 shadow-lg">
          {!versions || versions.length === 0 ? (
            <p className="p-2 text-xs text-muted">Sin versiones aún.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-auto">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-[color-mix(in_srgb,var(--border)_30%,transparent)]">
                  <span>
                    v{v.version} · {v.generado_por === "ia" ? "IA" : "humano"}
                    <br />
                    <span className="text-muted">{new Date(v.created_at).toLocaleString("es-CL")}</span>
                  </span>
                  <button onClick={() => onRestore(v.id)} className="text-brand hover:underline">
                    Restaurar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
