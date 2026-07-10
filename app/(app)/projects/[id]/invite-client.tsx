"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { invitarCliente } from "../actions";

export function InviteClient({ projectId }: { projectId: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function invite() {
    setBusy(true);
    try {
      setLink(await invitarCliente(projectId));
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo invitar");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="secondary" onClick={invite} disabled={busy}>
        {busy ? "Generando…" : "Invitar cliente"}
      </Button>
      {link && (
        <div className="flex max-w-xs items-center gap-1 rounded-lg border border-[var(--border-card)] bg-surface p-1 text-xs">
          <input readOnly value={link} className="w-56 truncate bg-transparent px-1 outline-none" />
          <button onClick={copy} className="shrink-0 rounded bg-brand px-2 py-0.5 text-brand-fg">
            {copied ? "✓" : "Copiar"}
          </button>
        </div>
      )}
    </div>
  );
}
