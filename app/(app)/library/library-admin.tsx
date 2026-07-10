"use client";

import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { LibraryItem, LibrarySeccion } from "@/lib/types";
import { saveLibraryItem, toggleLibraryActivo, deleteLibraryItem } from "./actions";

const SECCION_LABEL: Record<LibrarySeccion, string> = {
  onboarding: "Onboarding",
  curso1: "Curso · Profesional del Futuro",
  curso2: "Curso · Podcast en 30 días",
  curso3: "Curso · Videos con IA",
};

export function LibraryAdmin({ items }: { items: LibraryItem[] }) {
  const router = useRouter();

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted">Aún no hay elementos.</p>}
        {items.map((it) => (
          <Card key={it.id} className="flex items-center justify-between p-3">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-wider text-brand">
                {SECCION_LABEL[it.seccion]}
              </div>
              <div className="truncate font-medium">{it.titulo}</div>
              {it.embed_url && <div className="truncate text-xs text-muted">{it.embed_url}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={async () => {
                  await toggleLibraryActivo(it.id, !it.activo);
                  router.refresh();
                }}
                className={`text-xs ${it.activo ? "text-[var(--ok)]" : "text-muted"}`}
              >
                {it.activo ? "● activo" : "inactivo"}
              </button>
              <button
                onClick={async () => {
                  if (confirm("¿Eliminar?")) {
                    await deleteLibraryItem(it.id);
                    router.refresh();
                  }
                }}
                className="text-xs text-muted hover:text-[var(--danger)]"
              >
                ✕
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="h-fit p-4">
        <div className="mb-3 font-medium">Agregar</div>
        <form action={saveLibraryItem} className="space-y-2">
          <select name="seccion" className={input}>
            {(Object.keys(SECCION_LABEL) as LibrarySeccion[]).map((s) => (
              <option key={s} value={s}>{SECCION_LABEL[s]}</option>
            ))}
          </select>
          <input name="titulo" placeholder="Título" className={input} required />
          <input name="embed_url" placeholder="URL de YouTube/Vimeo" className={input} />
          <textarea name="descripcion" placeholder="Descripción (opcional)" className={`${input} h-16`} />
          <input name="orden" type="number" defaultValue={0} placeholder="Orden" className={input} />
          <SubmitButton variant="primary" className="w-full" pendingText="Guardando…">
            Guardar
          </SubmitButton>
        </form>
      </Card>
    </div>
  );
}

const input = "w-full rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm outline-none focus:border-brand";
