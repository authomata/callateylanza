"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { saveHouseVoice } from "./actions";

export function HouseVoiceEditor({ value }: { value: string }) {
  const router = useRouter();
  const [texto, setTexto] = useState(value);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await saveHouseVoice(texto);
      setMsg("Guardado ✓");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-brand">VOZ</span>{" "}
          <span className="font-semibold">Registro de la casa</span>
          <p className="mt-0.5 text-xs text-muted">
            Cómo se escribe todo entregable (no de qué se habla). Se inyecta en cada generación.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setOpen(!open)}>
          {open ? "Cerrar" : "Editar"}
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            className="h-72 w-full resize-y rounded-lg border border-[var(--border-card)] bg-background p-3 font-mono text-xs leading-relaxed outline-none focus:border-brand"
          />
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar registro"}
            </Button>
            {msg && <span className="text-xs text-secondary">{msg}</span>}
          </div>
        </div>
      )}
    </Card>
  );
}
