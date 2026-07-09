"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import type { InputRow, VoiceDoc } from "@/lib/types";
import { addInput, saveVoiceDoc } from "../actions";

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
      <div className="flex items-center gap-1 rounded-md border border-border bg-surface p-1 text-sm">
        <TabBtn active={pane === "insumos"} onClick={() => setPane("insumos")}>Insumos</TabBtn>
        <TabBtn active={pane === "voz"} onClick={() => setPane("voz")}>Documento de Voz</TabBtn>
      </div>
      {pane === "insumos" ? (
        <InsumosTab projectId={projectId} inputs={inputs} />
      ) : (
        <VoiceTab projectId={projectId} voiceDoc={voiceDoc} />
      )}
    </aside>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded px-2 py-1 ${active ? "bg-brand text-brand-fg" : "text-muted hover:text-foreground"}`}
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
      <div className="max-h-[30vh] space-y-1 overflow-auto">
        {inputs.length === 0 && <p className="px-1 text-xs text-muted">Sin insumos aún.</p>}
        {inputs.map((i) => (
          <button
            key={i.id}
            onClick={() => setViewing(viewing?.id === i.id ? null : i)}
            className="block w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-left text-xs hover:bg-[color-mix(in_srgb,var(--border)_30%,transparent)]"
          >
            <span className="font-medium">{INPUT_LABEL[i.tipo] ?? i.tipo}</span> — {i.titulo}
          </button>
        ))}
      </div>

      {viewing && (
        <div className="max-h-[24vh] overflow-auto rounded-md border border-border bg-surface p-2 text-xs whitespace-pre-wrap">
          {viewing.contenido_texto ?? "(archivo adjunto)"}
        </div>
      )}

      <Button variant="secondary" className="w-full" onClick={() => setOpen(!open)}>
        {open ? "Cerrar" : "+ Agregar insumo"}
      </Button>

      {open && (
        <form action={addInput} className="space-y-2 rounded-md border border-border bg-surface p-2">
          <input type="hidden" name="project_id" value={projectId} />
          <select name="tipo" className="w-full rounded border border-border bg-background px-2 py-1 text-sm">
            <option value="transcripcion">Transcripción</option>
            <option value="conclusiones">Conclusiones</option>
            <option value="otro">Otro</option>
          </select>
          <input
            name="titulo"
            placeholder="Título (ej. Sesión 1)"
            className="w-full rounded border border-border bg-background px-2 py-1 text-sm"
          />
          <textarea
            name="contenido_texto"
            placeholder="Pega aquí la transcripción o conclusiones…"
            className="h-28 w-full resize-y rounded border border-border bg-background p-2 text-sm"
          />
          <Button type="submit" variant="primary" className="w-full">Guardar insumo</Button>
        </form>
      )}
    </div>
  );
}

function VoiceTab({ projectId, voiceDoc }: { projectId: string; voiceDoc: VoiceDoc | null }) {
  const router = useRouter();
  const initial = {
    lexicon: voiceDoc?.lexicon ?? [],
    citas_canon: voiceDoc?.citas_canon ?? [],
    registro_si_no: voiceDoc?.registro_si_no ?? { si: [], no: [] },
    lineas_rojas: voiceDoc?.lineas_rojas ?? [],
  };
  const [json, setJson] = useState(JSON.stringify(initial, null, 2));
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    try {
      const parsed = JSON.parse(json);
      setError(null);
      await saveVoiceDoc(projectId, parsed);
      setEdit(false);
      router.refresh();
    } catch {
      setError("JSON inválido");
    }
  }

  if (edit) {
    return (
      <div className="space-y-2">
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          className="h-[46vh] w-full resize-y rounded-md border border-border bg-surface p-2 font-mono text-xs"
        />
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
        <div className="flex gap-2">
          <Button variant="primary" onClick={save} className="flex-1">Guardar</Button>
          <Button variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-xs">
      <Section title={`Lexicón (${initial.lexicon.length})`}>
        {initial.lexicon.length === 0 ? (
          <Empty />
        ) : (
          initial.lexicon.map((l, i) => (
            <div key={i} className="rounded border border-border p-1.5">
              <span className="font-medium">{l.expresion}</span>
              <span className="text-muted"> — {l.significado}</span>
            </div>
          ))
        )}
      </Section>
      <Section title={`Citas canon (${initial.citas_canon.length})`}>
        {initial.citas_canon.length === 0 ? (
          <Empty />
        ) : (
          initial.citas_canon.map((c, i) => (
            <blockquote key={i} className="border-l-2 border-[var(--accent)] pl-2 italic text-muted">
              “{c.cita}”
            </blockquote>
          ))
        )}
      </Section>
      <Section title="Registro">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="font-medium text-[var(--ok,#1f6b4c)]">SÍ suena a él</div>
            {initial.registro_si_no.si?.map((s, i) => <div key={i} className="text-muted">· {s}</div>)}
          </div>
          <div>
            <div className="font-medium text-[var(--danger)]">NUNCA</div>
            {initial.registro_si_no.no?.map((s, i) => <div key={i} className="text-muted">· {s}</div>)}
          </div>
        </div>
      </Section>
      <Section title="Líneas rojas">
        {initial.lineas_rojas.length === 0 ? <Empty /> : initial.lineas_rojas.map((l, i) => <div key={i} className="text-muted">· {l}</div>)}
      </Section>
      <Button variant="secondary" className="w-full" onClick={() => setEdit(true)}>Editar Documento de Voz</Button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border bg-surface p-2">
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{title}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Empty() {
  return <p className="text-muted">Vacío a resolver.</p>;
}
