"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { enviarMensaje } from "../actions";

export function ContactForm({ projectId }: { projectId: string | null }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (sending || !texto.trim() || !projectId) return;
    setSending(true);
    setError(null);
    try {
      await enviarMensaje(projectId, texto);
      setTexto("");
      setSent(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-card)] bg-subtle p-5">
      <div className="font-serif text-lg">¿Dudas sobre tu kit?</div>
      <p className="mt-1 text-sm text-secondary">
        Escríbenos aquí. Te respondemos por este mismo canal, con tu conversación siempre a mano.
      </p>

      {sent ? (
        <div className="mt-3 rounded-lg border border-[var(--ok)] bg-[var(--ok-bg)] px-3 py-2 text-sm text-[var(--ok)]">
          ✓ Mensaje enviado. Andrés y el equipo ya lo recibieron.
          <button onClick={() => setSent(false)} className="ml-2 underline">
            Enviar otro
          </button>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Cuéntanos qué necesitas…"
            className="h-24 w-full resize-y rounded-lg border border-[var(--border-card)] bg-background p-3 text-sm outline-none focus:border-brand"
          />
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={send} disabled={sending || !texto.trim()}>
              {sending ? "Enviando…" : "Enviar mensaje"}
            </Button>
            {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
