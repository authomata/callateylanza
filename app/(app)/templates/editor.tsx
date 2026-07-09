"use client";

import { useState } from "react";
import { Badge, Button, Card } from "@/components/ui";
import type { ModuleTemplate } from "@/lib/types";
import { updateTemplate, saveAsNewVersion, activateVersion } from "./actions";

export default function TemplateEditor({ tipo, versions }: { tipo: string; versions: ModuleTemplate[] }) {
  const active = versions.find((v) => v.activa) ?? versions[0];
  const [open, setOpen] = useState(false);
  const [t, setT] = useState(active);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted">{tipo}</span>
          <span className="font-semibold">{active?.nombre}</span>
          {active?.activa ? (
            <Badge label={`v${active.version} activa`} color="#1f6b4c" />
          ) : (
            <Badge label="inactiva" color="#9a978f" />
          )}
        </div>
        <div className="flex items-center gap-2">
          {versions.length > 1 && (
            <select
              className="rounded border border-border bg-background px-2 py-1 text-xs"
              value={t.id}
              onChange={(e) => setT(versions.find((v) => v.id === e.target.value)!)}
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  v{v.version} {v.activa ? "(activa)" : ""}
                </option>
              ))}
            </select>
          )}
          <Button variant="secondary" onClick={() => setOpen(!open)}>
            {open ? "Cerrar" : "Editar"}
          </Button>
        </div>
      </div>

      {open && (
        <form className="mt-4 space-y-3">
          <input type="hidden" name="id" value={t.id} />
          <input type="hidden" name="tipo" value={tipo} />
          <input type="hidden" name="inputs_requeridos" value={JSON.stringify(t.inputs_requeridos ?? [])} />

          <Labeled label="Nombre">
            <input name="nombre" defaultValue={t.nombre} className={input} />
          </Labeled>
          <Labeled label="Prompt del sistema">
            <textarea name="prompt_sistema" defaultValue={t.prompt_sistema} className={`${input} h-64 font-mono`} />
          </Labeled>
          <Labeled label="Estructura esperada del output">
            <textarea name="estructura_output" defaultValue={t.estructura_output ?? ""} className={`${input} h-20`} />
          </Labeled>
          <Labeled label="Checklist de calidad (una por línea)">
            <textarea
              name="checklist_calidad"
              defaultValue={(t.checklist_calidad ?? []).join("\n")}
              className={`${input} h-28`}
            />
          </Labeled>

          <div className="flex flex-wrap gap-2">
            <Button variant="primary" formAction={updateTemplate}>
              Guardar en v{t.version}
            </Button>
            <Button variant="secondary" formAction={saveAsNewVersion}>
              Guardar como nueva versión y activar
            </Button>
            {!t.activa && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => activateVersion(t.id, tipo as ModuleTemplate["tipo"])}
              >
                Activar esta versión
              </Button>
            )}
          </div>
        </form>
      )}
    </Card>
  );
}

const input =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand";

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}
