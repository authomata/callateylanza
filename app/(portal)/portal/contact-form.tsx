"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { MessageThread, type ThreadMsg } from "@/components/message-thread";
import { enviarMensaje } from "../actions";

export function ContactForm({ projectId, messages }: { projectId: string | null; messages: ThreadMsg[] }) {
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (sending || !texto.trim() || !projectId) return;
    setSending(true);
    setError(null);
    try {
      await enviarMensaje(projectId, texto);
      setTexto("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-card)] bg-subtle p-5">
      <div className="font-serif text-lg">Conversación con el equipo</div>
      <p className="mt-1 text-sm text-secondary">
        Escríbenos aquí. Todo queda en este mismo hilo, siempre a mano —{" "}
        <span className="text-muted">nada se pierde en correos.</span>
      </p>

      {messages.length > 0 && (
        <div className="mt-4 max-h-80 overflow-auto rounded-lg border border-[var(--border-card)] bg-background p-3">
          <MessageThread messages={messages} viewer="cliente" />
        </div>
      )}

      <div className="mt-3 space-y-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={messages.length ? "Escribe una respuesta…" : "Cuéntanos qué necesitas…"}
          className="h-20 w-full resize-y rounded-lg border border-[var(--border-card)] bg-background p-3 text-sm outline-none focus:border-brand"
        />
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={send} disabled={sending || !texto.trim()}>
            {sending ? "Enviando…" : "Enviar"}
          </Button>
          {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
        </div>
      </div>
    </section>
  );
}
