"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { addAporte } from "../actions";

export interface Aporte {
  id: string;
  titulo: string;
  contenido_texto: string | null;
  file_url: string | null;
  created_at: string;
}

export function AportesSection({ projectId, aportes }: { projectId: string | null; aportes: Aporte[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (busy || !projectId) return;
    if (!texto.trim() && !file) {
      setError("Agrega un texto/link o un archivo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let fileUrl: string | null = null;
      if (file) {
        const safe = file.name.replace(/[^\w.\-]/g, "_");
        const path = `${projectId}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("aportes").upload(path, file);
        if (upErr) throw new Error(`No se pudo subir el archivo: ${upErr.message}`);
        fileUrl = supabase.storage.from("aportes").getPublicUrl(path).data.publicUrl;
      }
      await addAporte(projectId, titulo, texto, fileUrl);
      setTitulo("");
      setTexto("");
      setFile(null);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-card)] bg-surface p-5">
      <h2 className="font-serif text-xl">Suma tu material</h2>
      <p className="mt-1 text-sm text-secondary">
        ¿Tienes charlas, textos, presentaciones o links que te representan? Compártelos aquí:
        alimentan tu voz y afinan tu kit. Mientras más nos das, más tuyo queda todo.
      </p>

      {aportes.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {aportes.map((a) => (
            <li key={a.id} className="rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm">
              <div className="font-medium">{a.titulo}</div>
              {a.contenido_texto && <div className="mt-0.5 line-clamp-2 text-xs text-muted">{a.contenido_texto}</div>}
              {a.file_url && (
                <a href={a.file_url} target="_blank" className="mt-0.5 inline-block text-xs text-brand hover:underline">
                  Ver archivo ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 space-y-2">
        <input
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Título (ej. «Charla TEDx 2023»)"
          className="w-full rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Pega aquí un texto, notas o links (YouTube, Drive, artículos…)"
          className="h-24 w-full resize-y rounded-lg border border-[var(--border-card)] bg-background p-3 text-sm outline-none focus:border-brand"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-lg border border-[var(--border-card)] px-3 py-1.5 text-sm hover:bg-[color-mix(in_srgb,var(--border)_40%,transparent)]">
            {file ? "Cambiar archivo" : "Adjuntar archivo"}
            <input
              type="file"
              hidden
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          {file && <span className="text-xs text-muted">{file.name}</span>}
          <Button variant="primary" onClick={submit} disabled={busy} className="ml-auto">
            {busy ? "Enviando…" : "Enviar material"}
          </Button>
        </div>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    </section>
  );
}
