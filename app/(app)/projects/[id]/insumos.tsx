"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { CitaCanon, InputRow, LexiconEntry, VoiceDoc } from "@/lib/types";
import { addInput, saveVoiceDoc, extractVoiceFromD0 } from "../actions";

const INPUT_LABEL: Record<string, string> = {
  transcripcion: "Transcripción",
  conclusiones: "Conclusiones",
  foto_referencia: "Foto ref.",
  otro: "Otro",
};

export default function InsumosPanel({
  projectId,
  inputs,
  voiceDoc,
}: {
  projectId: string;
  inputs: InputRow[];
  voiceDoc: VoiceDoc | null;
}) {
  const [pane, setPane] = useState<"insumos" | "voz">("insumos");
  return (
    <aside className="space-y-3">
      <div className="flex items-center gap-1 rounded-lg border border-[var(--border-card)] bg-surface p-1 text-sm">
        <TabBtn active={pane === "insumos"} onClick={() => setPane("insumos")}>Insumos</TabBtn>
        <TabBtn active={pane === "voz"} onClick={() => setPane("voz")}>Documento de Voz</TabBtn>
      </div>
      {pane === "insumos" ? (
        <InsumosTab projectId={projectId} inputs={inputs} />
      ) : (
        <VoiceTab
          key={`${voiceDoc?.lexicon?.length ?? 0}-${voiceDoc?.citas_canon?.length ?? 0}-${voiceDoc?.lineas_rojas?.length ?? 0}`}
          projectId={projectId}
          voiceDoc={voiceDoc}
        />
      )}
      <p className="px-1 text-xs text-muted">
        Los insumos alimentan la generación. El Documento de Voz se inyecta en todos los entregables.
      </p>
    </aside>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md px-2 py-1 ${active ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}

function InsumosTab({ projectId, inputs }: { projectId: string; inputs: InputRow[] }) {
  const [open, setOpen] = useState(inputs.length === 0);
  const [viewing, setViewing] = useState<InputRow | null>(null);

  return (
    <div className="space-y-2">
      <div className="max-h-[30vh] space-y-1.5 overflow-auto">
        {inputs.length === 0 && <p className="px-1 text-xs text-muted">Sin insumos aún.</p>}
        {inputs.map((i) => (
          <button
            key={i.id}
            onClick={() => setViewing(viewing?.id === i.id ? null : i)}
            className="block w-full rounded-lg border border-[var(--border-card)] bg-surface px-2.5 py-2 text-left text-xs hover:bg-[color-mix(in_srgb,var(--border)_30%,transparent)]"
          >
            <span className="font-mono text-[10px] uppercase tracking-wider text-brand">
              {INPUT_LABEL[i.tipo] ?? i.tipo}
            </span>
            <div className="text-secondary">{i.titulo}</div>
          </button>
        ))}
      </div>

      {viewing && (
        <div className="max-h-[24vh] overflow-auto rounded-lg border border-[var(--border-card)] bg-surface p-2 text-xs whitespace-pre-wrap text-secondary">
          {viewing.contenido_texto ?? "(archivo adjunto)"}
        </div>
      )}

      <Button variant="secondary" className="w-full" onClick={() => setOpen(!open)}>
        {open ? "Cerrar" : "+ Agregar insumo"}
      </Button>

      {open && (
        <form action={addInput} className="space-y-2 rounded-lg border border-[var(--border-card)] bg-surface p-2">
          <input type="hidden" name="project_id" value={projectId} />
          <select name="tipo" className="w-full rounded-md border border-[var(--border-card)] bg-background px-2 py-1 text-sm">
            <option value="transcripcion">Transcripción</option>
            <option value="conclusiones">Conclusiones</option>
            <option value="otro">Otro</option>
          </select>
          <input
            name="titulo"
            placeholder="Título (ej. Sesión 1)"
            className="w-full rounded-md border border-[var(--border-card)] bg-background px-2 py-1 text-sm"
          />
          <textarea
            name="contenido_texto"
            placeholder="Pega aquí la transcripción o conclusiones…"
            className="h-28 w-full resize-y rounded-md border border-[var(--border-card)] bg-background p-2 text-sm"
          />
          <SubmitButton variant="primary" className="w-full" pendingText="Guardando insumo…">
            Guardar insumo
          </SubmitButton>
        </form>
      )}
    </div>
  );
}

// ── Documento de Voz — editable por tablas ──────────────────────────────────
function VoiceTab({ projectId, voiceDoc }: { projectId: string; voiceDoc: VoiceDoc | null }) {
  const router = useRouter();
  const [lexicon, setLexicon] = useState<LexiconEntry[]>(voiceDoc?.lexicon ?? []);
  const [citas, setCitas] = useState<CitaCanon[]>(voiceDoc?.citas_canon ?? []);
  const [si, setSi] = useState<string[]>(voiceDoc?.registro_si_no?.si ?? []);
  const [no, setNo] = useState<string[]>(voiceDoc?.registro_si_no?.no ?? []);
  const [rojas, setRojas] = useState<string[]>(voiceDoc?.lineas_rojas ?? []);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState(false);
  const [extracting, setExtracting] = useState(false);

  const vacio =
    lexicon.length === 0 && citas.length === 0 && si.length === 0 && no.length === 0 && rojas.length === 0;

  async function extraer() {
    if (extracting) return;
    setExtracting(true);
    try {
      await extractVoiceFromD0(projectId);
      router.refresh(); // el key remonta el tab con la voz extraída
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo extraer");
    } finally {
      setExtracting(false);
    }
  }

  async function save() {
    if (saving) return;
    setSaving(true);
    try {
      await saveVoiceDoc(projectId, {
        lexicon,
        citas_canon: citas,
        registro_si_no: { si, no },
        lineas_rojas: rojas,
      });
      setFlash(true);
      setTimeout(() => setFlash(false), 2000);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-dashed border-[var(--border-card)] bg-subtle p-2.5 text-xs text-secondary">
        {vacio ? (
          <>Se llena automáticamente al generar <strong>D0</strong>. ¿Ya lo generaste?{" "}</>
        ) : (
          <>Extraído del D0. Puedes corregir las tablas y guardar.{" "}</>
        )}
        <button onClick={extraer} disabled={extracting} className="font-medium text-brand hover:underline disabled:opacity-50">
          {extracting ? "Extrayendo…" : "Extraer del D0"}
        </button>
      </div>

      <Section title={`Lexicón (${lexicon.length})`}>
        {lexicon.map((l, i) => (
          <div key={i} className="space-y-1 rounded-md border border-[var(--border-card)] bg-background p-1.5">
            <Field value={l.expresion} placeholder="expresión textual" onChange={(v) => setLexicon(upd(lexicon, i, { expresion: v }))} />
            <Field value={l.significado} placeholder="qué significa / de dónde viene" onChange={(v) => setLexicon(upd(lexicon, i, { significado: v }))} />
            <RemoveBtn onClick={() => setLexicon(rm(lexicon, i))} />
          </div>
        ))}
        <AddBtn onClick={() => setLexicon([...lexicon, { expresion: "", significado: "", de_donde_viene: "", como_usarla: "" }])} />
      </Section>

      <Section title={`Citas canon (${citas.length})`}>
        {citas.map((c, i) => (
          <div key={i} className="space-y-1 rounded-md border border-[var(--border-card)] bg-background p-1.5">
            <Field value={c.cita} placeholder="frase textual del cliente" onChange={(v) => setCitas(upd(citas, i, { cita: v }))} />
            <Field value={c.contexto} placeholder="contexto" onChange={(v) => setCitas(upd(citas, i, { contexto: v }))} />
            <RemoveBtn onClick={() => setCitas(rm(citas, i))} />
          </div>
        ))}
        <AddBtn onClick={() => setCitas([...citas, { cita: "", contexto: "" }])} />
      </Section>

      <Section title="Registro">
        <div className="mb-1 font-medium text-[var(--ok)]">SÍ suena a él</div>
        <StringList items={si} setItems={setSi} placeholder="…" />
        <div className="mb-1 mt-2 font-medium text-[var(--danger)]">NUNCA suena a él</div>
        <StringList items={no} setItems={setNo} placeholder="…" />
      </Section>

      <Section title={`Líneas rojas (${rojas.length})`}>
        <StringList items={rojas} setItems={setRojas} placeholder="ej. de prácticas, nunca de personas" />
      </Section>

      <Button variant="primary" className="w-full" onClick={save} disabled={saving}>
        {saving ? "Guardando…" : flash ? "Guardado ✓" : "Guardar Documento de Voz"}
      </Button>
    </div>
  );
}

// helpers de arrays
function upd<T>(arr: T[], i: number, patch: Partial<T>): T[] {
  return arr.map((x, j) => (j === i ? { ...x, ...patch } : x));
}
function rm<T>(arr: T[], i: number): T[] {
  return arr.filter((_, j) => j !== i);
}

function StringList({ items, setItems, placeholder }: { items: string[]; setItems: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-1">
      {items.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <Field value={s} placeholder={placeholder} onChange={(v) => setItems(items.map((x, j) => (j === i ? v : x)))} />
          <button onClick={() => setItems(items.filter((_, j) => j !== i))} className="shrink-0 px-1 text-muted hover:text-[var(--danger)]">
            ✕
          </button>
        </div>
      ))}
      <AddBtn onClick={() => setItems([...items, ""])} />
    </div>
  );
}

function Field({ value, placeholder, onChange }: { value: string; placeholder: string; onChange: (v: string) => void }) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded border border-[var(--border-card)] bg-surface px-1.5 py-1 text-xs outline-none focus:border-brand"
    />
  );
}

function AddBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-xs text-brand hover:underline">
      + agregar
    </button>
  );
}
function RemoveBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-[11px] text-muted hover:text-[var(--danger)]">
      Eliminar
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border-card)] bg-surface p-2">
      <div className="mb-1.5 font-mono text-[10px] uppercase tracking-wider text-muted">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}
