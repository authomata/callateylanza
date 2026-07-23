"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { MessageThread, type ThreadMsg } from "@/components/message-thread";
import { getComentarios, comentar } from "@/app/(portal)/actions";

type Row = { id: string; texto: string; created_at: string; users: { nombre: string; rol: string } | null };

function toThread(rows: Row[]): ThreadMsg[] {
  return rows.map((r) => ({
    id: r.id,
    texto: r.texto,
    created_at: r.created_at,
    de_equipo: (r.users?.rol ?? "operador") !== "cliente",
    autor: r.users?.nombre ?? null,
  }));
}

// Hilo de comentarios de un entregable. viewer define de qué lado se ven las burbujas.
export function DeliverableComments({
  deliverableId,
  viewer,
  titulo = "Comentarios",
  nota,
}: {
  deliverableId: string;
  viewer: "cliente" | "equipo";
  titulo?: string;
  nota?: string;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [texto, setTexto] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    getComentarios(deliverableId).then((d) => active && setRows(d as unknown as Row[]));
    return () => {
      active = false;
    };
  }, [deliverableId]);

  async function send() {
    if (!texto.trim() || sending) return;
    setSending(true);
    try {
      await comentar(deliverableId, texto);
      setTexto("");
      setRows((await getComentarios(deliverableId)) as unknown as Row[]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo comentar");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-card)] bg-surface p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className={viewer === "cliente" ? "font-serif text-lg" : "font-mono text-[10px] uppercase tracking-wider text-muted"}>
          {titulo} ({rows.length})
        </h3>
      </div>
      {nota && <p className="mb-2 text-xs text-muted">{nota}</p>}

      {rows.length > 0 && (
        <div className="mb-3 max-h-72 overflow-auto rounded-lg border border-[var(--border-card)] bg-background p-3">
          <MessageThread messages={toThread(rows)} viewer={viewer} />
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={viewer === "cliente" ? "¿Algo que ajustar o preguntar sobre este documento?" : "Comentar este entregable…"}
          className="h-16 flex-1 resize-none rounded-lg border border-[var(--border-card)] bg-background p-2.5 text-sm outline-none focus:border-brand"
        />
        <Button variant="primary" onClick={send} disabled={sending || !texto.trim()}>
          {sending ? "…" : "Enviar"}
        </Button>
      </div>
    </div>
  );
}
