"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { updateClient } from "../actions";

export interface ClientData {
  id: string;
  nombre: string;
  email: string | null;
  ciudad: string | null;
  rubro: string | null;
}

export function ClientEditor({ projectId, client }: { projectId: string; client: ClientData }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <Button variant="ghost" onClick={() => setOpen(!open)}>
        {open ? "Cerrar" : "Editar cliente"}
      </Button>
      {!client.email && !open && (
        <div className="mt-1 text-right text-[10px] text-[var(--danger)]">Sin email · no se puede invitar</div>
      )}

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-xl border border-[var(--border-card)] bg-surface p-3 shadow-lg">
          <form action={updateClient} className="space-y-2 text-left">
            <input type="hidden" name="project_id" value={projectId} />
            <input type="hidden" name="client_id" value={client.id} />
            <Field name="nombre" label="Nombre" defaultValue={client.nombre} required />
            <Field name="email" label="Email" type="email" defaultValue={client.email ?? ""} />
            <div className="grid grid-cols-2 gap-2">
              <Field name="ciudad" label="Ciudad" defaultValue={client.ciudad ?? ""} />
              <Field name="rubro" label="Rubro" defaultValue={client.rubro ?? ""} />
            </div>
            <SubmitButton variant="primary" className="w-full" pendingText="Guardando…">
              Guardar
            </SubmitButton>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-[var(--border-card)] bg-background px-2.5 py-1.5 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
