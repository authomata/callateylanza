"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { DocView } from "@/components/doc-view";
import { PipelineRail } from "@/components/pipeline-rail";
import { AssetManager } from "@/components/asset-manager";
import { LandingPanel } from "@/components/landing-panel";
import { DELIVERABLE_ESTADO } from "@/lib/estados";
import { autoCorrectVoseo } from "@/lib/validators/voseo";
import { runValidators } from "@/lib/validators";
import { computeAvailability, nextRecommended } from "@/lib/pipeline";
import type { Deliverable, InputRow, ModuleTemplate, UserRol, VoiceDoc } from "@/lib/types";
import {
  updateDeliverableContent,
  saveDeliverableVersion,
  setDeliverableEstado,
  getVersions,
  restoreVersion,
  overrideUnlock,
  rechazar,
  addComment,
  getComments,
  publicar,
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
  const [selId, setSelId] = useState<string>(() => {
    const next = nextRecommended(deliverables);
    return (
      (next && deliverables.find((d) => d.tipo === next)?.id) ??
      deliverables.find((d) => d.tipo === "D1")?.id ??
      deliverables[0]?.id ??
      ""
    );
  });
  const selected = items.find((d) => d.id === selId) ?? null;

  const availability = useMemo(() => computeAvailability(items), [items]);
  const nextTipo = useMemo(() => nextRecommended(items), [items]);
  const selAvail = selected ? availability[selected.tipo] : undefined;

  // editor buffer
  const [buffer, setBuffer] = useState<string>(selected?.contenido_md ?? "");
  const [tab, setTab] = useState<"editar" | "vista">("vista");
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [instrucciones, setInstrucciones] = useState("");
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState<null | "listo" | "approve" | "save" | "unlock" | "reject" | "publish">(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectText, setRejectText] = useState("");
  const [flash, setFlash] = useState<string | null>(null);
  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 2600);
  }

  // reset buffer when selection changes (adjust-state-during-render)
  const [prevSel, setPrevSel] = useState(selId);
  if (selId !== prevSel) {
    setPrevSel(selId);
    setBuffer(selected?.contenido_md ?? "");
    setTab(selected?.contenido_md ? "vista" : "editar");
  }

  const template = templates.find((t) => t.tipo === selected?.tipo);
  const report = useMemo(() => runValidators(selected?.tipo ?? "D1", buffer), [buffer, selected?.tipo]);
  const voseo = report.voseo;
  const cleanForListo = voseo.length === 0 && (!report.length || report.length.ok) && (!report.anchors || report.anchors.ok);

  const patchItem = useCallback((id: string, patch: Partial<Deliverable>) => {
    setItems((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }, []);

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
      setTab("vista");
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  async function marcarListo() {
    if (busy) return;
    if (!cleanForListo) {
      alert("Corrige las validaciones (voseo / anclas / largo) antes de marcar listo para revisión.");
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
      // marcar aprobado localmente → la disponibilidad de los dependientes se recomputa sola
      patchItem(selId, { estado: "aprobado" });
      showFlash(data.unlocked ? "Aprobado ✓ — se habilita la etapa siguiente" : "Aprobado ✓");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function doReject() {
    if (!rejectText.trim()) {
      alert("Escribe el motivo del rechazo para que el operador sepa qué ajustar.");
      return;
    }
    setBusy("reject");
    try {
      await rechazar(selId, rejectText);
      patchItem(selId, { estado: "rechazado" });
      setRejecting(false);
      setRejectText("");
      showFlash("Devuelto con comentarios ✓");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    if (busy) return;
    setBusy("publish");
    try {
      await publicar(selId);
      patchItem(selId, { estado: "publicado" });
      showFlash("Publicado al portal del cliente ✓");
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setBusy(null);
    }
  }

  async function unlock() {
    if (busy) return;
    setBusy("unlock");
    try {
      await overrideUnlock(selId);
      patchItem(selId, { desbloqueo_manual: true });
      showFlash("Desbloqueado manualmente ✓");
    } finally {
      setBusy(null);
    }
  }

  function applyAutocorrect() {
    onEdit(autoCorrectVoseo(buffer));
  }

  const est = selected ? DELIVERABLE_ESTADO[selected.estado] : null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr_320px]">
      {/* LEFT — camino */}
      <PipelineRail items={items} availability={availability} selId={selId} onSelect={setSelId} nextTipo={nextTipo} />

      {/* CENTER — editor */}
      <section className="min-w-0 space-y-3">
        {!selected ? (
          <p className="text-muted">Selecciona un entregable.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs text-brand">{selected.tipo}</span>
                <h2 className="font-serif text-2xl">{selected.titulo}</h2>
                {est && <Badge label={est.label} color={est.color} />}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                {saving === "saving" && <span>Guardando…</span>}
                {saving === "saved" && <span>Guardado ✓</span>}
                <span className="font-mono">v{selected.version_actual}</span>
              </div>
            </div>

            {flash && (
              <div className="rounded-lg border border-[var(--ok)] bg-[var(--ok-bg)] px-3 py-2 text-sm font-medium text-[var(--ok)]">
                {flash}
              </div>
            )}

            <GateOrControls
              selected={selected}
              disponible={selAvail?.disponible ?? true}
              faltan={selAvail?.faltan ?? []}
              userRol={userRol}
              generating={generating}
              busy={busy}
              instrucciones={instrucciones}
              setInstrucciones={setInstrucciones}
              onGenerate={generate}
              onUnlock={unlock}
            />

            {/* tabs */}
            <div className="flex items-center gap-1 border-b border-border">
              {(["vista", "editar"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-3 py-1.5 text-sm capitalize ${
                    tab === t ? "border-b-2 border-brand font-medium text-foreground" : "text-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-2 py-1">
                <VersionHistory
                  deliverableId={selId}
                  onRestore={async (vid) => {
                    await restoreVersion(selId, vid);
                    router.refresh();
                    const d = items.find((i) => i.id === selId);
                    if (d) setBuffer(d.contenido_md ?? "");
                  }}
                />
                <Button variant="ink" onClick={snapshot} disabled={generating || busy !== null}>
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
                className="h-[54vh] w-full resize-y rounded-xl border border-[var(--border-card)] bg-surface p-4 font-mono text-[13px] leading-relaxed outline-none focus:border-brand"
              />
            ) : (
              <div className="h-[54vh] overflow-auto rounded-xl border border-[var(--border-card)] bg-surface px-8 py-7 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                <DocView tipo={selected.tipo}>{buffer}</DocView>
              </div>
            )}

            {/* validadores */}
            <VoseoPanel findings={voseo} onFixAll={applyAutocorrect} />
            {report.anchors && <ValidatorLine ok={report.anchors.ok} text={report.anchors.message} />}
            {report.length && (
              <ValidatorLine
                ok={report.length.ok}
                text={`${report.length.chars.toLocaleString("es-CL")} / ${report.length.max.toLocaleString("es-CL")} caracteres`}
              />
            )}

            {template && template.checklist_calidad?.length > 0 && <Checklist items={template.checklist_calidad} />}

            {/* acciones */}
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
                <>
                  <Button variant="primary" onClick={approve} disabled={busy !== null}>
                    {busy === "approve" ? "Aprobando…" : "Aprobar"}
                  </Button>
                  <Button variant="danger" onClick={() => setRejecting((r) => !r)} disabled={busy !== null}>
                    Rechazar
                  </Button>
                </>
              )}
              {userRol === "admin" && selected.estado === "aprobado" && (
                <Button variant="primary" onClick={publish} disabled={busy !== null}>
                  {busy === "publish" ? "Publicando…" : "Publicar al portal"}
                </Button>
              )}
              {selected.estado === "publicado" && (
                <span className="text-xs text-[var(--ok)]">● Publicado al portal</span>
              )}
              <a href={`/print/${selId}`} target="_blank" className="ml-auto text-sm text-brand hover:underline">
                Exportar PDF ↗
              </a>
            </div>

            {rejecting && (
              <div className="rounded-xl border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_5%,transparent)] p-3">
                <textarea
                  value={rejectText}
                  onChange={(e) => setRejectText(e.target.value)}
                  placeholder="¿Qué debe ajustar el operador? Este comentario le llega a la campanita."
                  className="mb-2 h-20 w-full resize-none rounded-lg border border-[var(--border-card)] bg-background p-2 text-sm outline-none focus:border-[var(--danger)]"
                />
                <div className="flex gap-2">
                  <Button variant="danger" onClick={doReject} disabled={busy !== null}>
                    {busy === "reject" ? "Enviando…" : "Confirmar rechazo"}
                  </Button>
                  <Button variant="ghost" onClick={() => setRejecting(false)}>Cancelar</Button>
                </div>
              </div>
            )}

            {(selected.tipo === "D6" || selected.tipo === "D8") && (
              <AssetManager projectId={projectId} deliverableId={selId} tipo={selected.tipo} />
            )}

            {selected.tipo === "D5" && <LandingPanel projectId={projectId} />}

            <CommentsThread deliverableId={selId} />
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
  disponible,
  faltan,
  userRol,
  generating,
  busy,
  instrucciones,
  setInstrucciones,
  onGenerate,
  onUnlock,
}: {
  selected: Deliverable;
  disponible: boolean;
  faltan: string[];
  userRol: UserRol;
  generating: boolean;
  busy: string | null;
  instrucciones: string;
  setInstrucciones: (v: string) => void;
  onGenerate: () => void;
  onUnlock: () => void;
}) {
  if (!disponible) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--border-card)] bg-surface p-4 text-sm text-secondary">
        <div className="mb-1">
          🔒 Bloqueado. Este entregable necesita aprobar primero{" "}
          <strong className="font-mono text-brand">{faltan.join(" · ")}</strong>.
        </div>
        <p className="text-xs text-muted">
          Sigue el camino: cada paso se habilita cuando sus insumos están listos.
        </p>
        {userRol === "admin" && (
          <Button variant="ghost" className="mt-2" onClick={onUnlock} disabled={busy !== null}>
            {busy === "unlock" ? "Desbloqueando…" : "Desbloquear de todos modos (admin)"}
          </Button>
        )}
      </div>
    );
  }
  const isRegen = !!selected.contenido_md;
  return (
    <div className="rounded-xl border border-[var(--border-card)] bg-surface p-3.5 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
      <textarea
        value={instrucciones}
        onChange={(e) => setInstrucciones(e.target.value)}
        placeholder="Instrucciones adicionales (opcional): «hazlo más filoso», «usa la historia del avión»…"
        className="mb-2.5 h-14 w-full resize-none rounded-lg border border-[var(--border-card)] bg-background p-2.5 font-serif text-[15px] italic text-secondary outline-none placeholder:text-muted focus:border-brand"
      />
      <div className="flex items-center gap-3">
        <Button variant="primary" onClick={onGenerate} disabled={generating}>
          {generating ? "Generando…" : isRegen ? "↻ Regenerar" : "Generar"}
        </Button>
        {isRegen && <span className="text-xs text-muted">v{selected.version_actual} · última generación guardada</span>}
      </div>
    </div>
  );
}

function ValidatorLine({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-xs ${
        ok
          ? "border-[var(--border-card)] bg-surface text-[var(--ok)]"
          : "border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] text-[var(--danger)]"
      }`}
    >
      {ok ? "✓ " : "⚠ "}
      {text}
    </div>
  );
}

function VoseoPanel({ findings, onFixAll }: { findings: { line: number; match: string; suggestion: string }[]; onFixAll: () => void }) {
  if (findings.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--border-card)] bg-surface px-3 py-2 text-xs text-[var(--ok)]">
        ✓ Sin voseo detectado — español de Chile.
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-[var(--danger)] bg-[color-mix(in_srgb,var(--danger)_6%,transparent)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--danger)]">
          {findings.length} forma(s) de voseo detectada(s)
        </span>
        <Button variant="danger" onClick={onFixAll}>Corregir todo</Button>
      </div>
      <ul className="max-h-24 space-y-0.5 overflow-auto text-xs text-muted">
        {findings.slice(0, 20).map((f, i) => (
          <li key={i}>
            línea {f.line}: <span className="font-mono text-[var(--danger)]">{f.match}</span> →{" "}
            <span className="font-mono">{f.suggestion}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
  return (
    <details className="rounded-lg border border-[var(--border-card)] bg-surface p-3 text-sm">
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
            <span className={checked[i] ? "text-muted line-through" : "text-secondary"}>{it}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

type Cmt = { id: string; texto: string; created_at: string; users: { nombre: string } | null };

function CommentsThread({ deliverableId }: { deliverableId: string }) {
  const [comments, setComments] = useState<Cmt[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getComments(deliverableId).then((c) => {
      if (active) setComments(c as unknown as Cmt[]);
    });
    return () => {
      active = false;
    };
  }, [deliverableId]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      await addComment(deliverableId, text);
      setText("");
      setComments((await getComments(deliverableId)) as unknown as Cmt[]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-card)] bg-surface p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted">
        Comentarios ({comments.length})
      </div>
      {comments.length > 0 && (
        <ul className="mb-2 space-y-2">
          {comments.map((c) => (
            <li key={c.id} className="border-l-2 border-[var(--border)] pl-2 text-sm">
              <span className="text-secondary">{c.texto}</span>
              <span className="mt-0.5 block text-[10px] text-muted">
                {c.users?.nombre ?? "—"} · {new Date(c.created_at).toLocaleString("es-CL")}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Agregar un comentario…"
          className="flex-1 rounded-lg border border-[var(--border-card)] bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand"
        />
        <Button variant="secondary" onClick={send} disabled={sending || !text.trim()}>
          {sending ? "…" : "Enviar"}
        </Button>
      </div>
    </div>
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
        <div className="absolute right-0 z-10 mt-1 w-64 rounded-xl border border-[var(--border-card)] bg-surface p-2 shadow-lg">
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
