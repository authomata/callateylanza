"use client";

export interface ThreadMsg {
  id: string;
  texto: string;
  de_equipo: boolean;
  created_at: string;
  autor?: string | null;
}

function ts(iso: string): string {
  return new Date(iso).toLocaleString("es-CL", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Conversación en burbujas. `side` define de qué lado va "el equipo":
// en el portal (viewer = cliente) el equipo va a la izquierda; en el buzón, a la derecha.
export function MessageThread({ messages, viewer }: { messages: ThreadMsg[]; viewer: "cliente" | "equipo" }) {
  if (messages.length === 0) {
    return <p className="py-3 text-center text-xs text-muted">Aún no hay mensajes en esta conversación.</p>;
  }
  return (
    <div className="space-y-2.5">
      {messages.map((m) => {
        const mine = viewer === "equipo" ? m.de_equipo : !m.de_equipo;
        const label = m.de_equipo ? m.autor || "Equipo" : "Cliente";
        return (
          <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl border px-3 py-2 ${
              m.de_equipo
                ? "border-[var(--border-card)] bg-[color-mix(in_srgb,var(--brand)_8%,transparent)]"
                : "border-[var(--border-card)] bg-surface"
            }`}>
              <div className="mb-0.5 flex items-center gap-2 text-[10px] text-muted">
                <span className="font-mono uppercase tracking-wider">{label}</span>
                <span>{ts(m.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-secondary">{m.texto}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
