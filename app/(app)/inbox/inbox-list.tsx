"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { MessageThread, type ThreadMsg } from "@/components/message-thread";
import { responderMensaje, marcarThreadResuelto } from "./actions";

export interface RawMessage {
  id: string;
  texto: string;
  resuelto: boolean;
  de_equipo: boolean;
  created_at: string;
  project_id: string;
  projects: { id: string; nombre: string; clients: { nombre: string; email: string | null } | null } | null;
  users: { nombre: string } | null;
}

interface Thread {
  projectId: string;
  projectName: string;
  clientName: string;
  clientEmail: string | null;
  messages: RawMessage[];
  pendiente: boolean; // hay mensajes del cliente sin resolver
  lastAt: string;
}

function buildThreads(messages: RawMessage[]): Thread[] {
  const byProject = new Map<string, RawMessage[]>();
  for (const m of messages) {
    if (!byProject.has(m.project_id)) byProject.set(m.project_id, []);
    byProject.get(m.project_id)!.push(m);
  }
  const threads: Thread[] = [];
  for (const [projectId, msgs] of byProject) {
    const proj = msgs.find((m) => m.projects)?.projects;
    threads.push({
      projectId,
      projectName: proj?.nombre ?? "Proyecto",
      clientName: proj?.clients?.nombre ?? "Cliente",
      clientEmail: proj?.clients?.email ?? null,
      messages: msgs,
      pendiente: msgs.some((m) => !m.de_equipo && !m.resuelto),
      lastAt: msgs[msgs.length - 1]?.created_at ?? "",
    });
  }
  return threads.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function InboxThreads({ messages }: { messages: RawMessage[] }) {
  const [filtro, setFiltro] = useState<"pendientes" | "todos">("pendientes");
  const threads = useMemo(() => buildThreads(messages), [messages]);
  const visibles = filtro === "pendientes" ? threads.filter((t) => t.pendiente) : threads;

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
          {filtro === "pendientes" ? "No hay conversaciones pendientes." : "El buzón está vacío."}
        </p>
      ) : (
        visibles.map((t) => <ThreadCard key={t.projectId} thread={t} />)
      )}
    </div>
  );
}

function ThreadCard({ thread }: { thread: Thread }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState<null | "send" | "resolve">(null);

  const msgs: ThreadMsg[] = thread.messages.map((m) => ({
    id: m.id,
    texto: m.texto,
    de_equipo: m.de_equipo,
    created_at: m.created_at,
    autor: m.de_equipo ? m.users?.nombre ?? "Equipo" : thread.clientName,
  }));

  async function send() {
    if (!reply.trim() || busy) return;
    setBusy("send");
    try {
      await responderMensaje(thread.projectId, reply);
      setReply("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function resolve() {
    setBusy("resolve");
    try {
      await marcarThreadResuelto(thread.projectId, thread.pendiente);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span>
          <strong className="font-serif text-base">{thread.clientName}</strong>
          <span className="text-xs text-muted"> · {thread.projectName}</span>
        </span>
        {thread.pendiente ? (
          <span className="rounded-full bg-[color-mix(in_srgb,var(--brand)_14%,transparent)] px-2 py-0.5 text-xs font-medium text-brand">
            Pendiente
          </span>
        ) : (
          <span className="text-xs text-[var(--ok)]">● Al día</span>
        )}
      </div>

      <div className="max-h-72 overflow-auto rounded-lg border border-[var(--border-card)] bg-background p-3">
        <MessageThread messages={msgs} viewer="equipo" />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Responder en el hilo…"
          className="h-16 flex-1 resize-none rounded-lg border border-[var(--border-card)] bg-background p-2.5 text-sm outline-none focus:border-brand"
        />
        <Button variant="primary" onClick={send} disabled={busy !== null || !reply.trim()}>
          {busy === "send" ? "…" : "Responder"}
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-4 text-xs">
        <button onClick={resolve} disabled={busy !== null} className="text-brand hover:underline">
          {busy === "resolve" ? "…" : thread.pendiente ? "Marcar resuelto" : "Reabrir"}
        </button>
        <a href={`/projects/${thread.projectId}`} className="text-muted hover:text-foreground">
          Abrir proyecto →
        </a>
      </div>
    </Card>
  );
}
