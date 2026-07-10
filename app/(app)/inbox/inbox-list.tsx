"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { marcarMensaje } from "./actions";

export interface InboxMessage {
  id: string;
  texto: string;
  resuelto: boolean;
  created_at: string;
  clients: { nombre: string; email: string | null } | null;
  projects: { id: string; nombre: string } | null;
}

export function InboxList({ messages }: { messages: InboxMessage[] }) {
  const router = useRouter();
  const [filtro, setFiltro] = useState<"pendientes" | "todos">("pendientes");
  const [busy, setBusy] = useState<string | null>(null);

  const visibles = filtro === "pendientes" ? messages.filter((m) => !m.resuelto) : messages;

  async function toggle(m: InboxMessage) {
    setBusy(m.id);
    try {
      await marcarMensaje(m.id, !m.resuelto);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1 border-b border-border">
        {(["pendientes", "todos"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFiltro(f)}
            className={`px-3 py-2 text-sm capitalize ${
              filtro === f ? "border-b-2 border-brand font-medium text-foreground" : "text-muted"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {visibles.length === 0 ? (
        <p className="py-8 text-center text-muted">
          {filtro === "pendientes" ? "No hay mensajes pendientes." : "El buzón está vacío."}
        </p>
      ) : (
        visibles.map((m) => (
          <Card key={m.id} className={`p-4 ${m.resuelto ? "opacity-60" : ""}`}>
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-secondary">
                <strong className="font-serif text-sm text-foreground">{m.clients?.nombre ?? "Cliente"}</strong>
                {m.projects && <span className="text-muted"> · {m.projects.nombre}</span>}
              </span>
              <span className="font-mono text-muted">
                {new Date(m.created_at).toLocaleString("es-CL", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="whitespace-pre-wrap text-sm text-secondary">{m.texto}</p>
            <div className="mt-3 flex items-center gap-4 text-xs">
              <button onClick={() => toggle(m)} disabled={busy === m.id} className="text-brand hover:underline">
                {busy === m.id ? "…" : m.resuelto ? "Reabrir" : "Marcar resuelto"}
              </button>
              {m.clients?.email && (
                <a href={`mailto:${m.clients.email}`} className="text-muted hover:text-foreground">
                  Responder por correo ↗
                </a>
              )}
              {m.projects && (
                <a href={`/projects/${m.projects.id}`} className="text-muted hover:text-foreground">
                  Abrir proyecto →
                </a>
              )}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
