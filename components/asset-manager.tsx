"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addAsset, getAssets, setAssetFlags, deleteAsset } from "@/app/(app)/projects/actions";

type Asset = {
  id: string;
  tipo: string;
  categoria: string | null;
  file_url: string;
  aprobado: boolean;
  publicado: boolean;
};

export function AssetManager({
  projectId,
  deliverableId,
  tipo,
}: {
  projectId: string;
  deliverableId: string;
  tipo: "D6" | "D8";
}) {
  const assetTipo = tipo === "D6" ? "foto" : "video";
  const accept = tipo === "D6" ? "image/*" : "video/*";
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const supabase = createClient();

  async function reload() {
    setAssets((await getAssets(deliverableId)) as unknown as Asset[]);
  }
  useEffect(() => {
    let active = true;
    getAssets(deliverableId).then((d) => {
      if (active) setAssets(d as unknown as Asset[]);
    });
    return () => {
      active = false;
    };
  }, [deliverableId]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const safe = file.name.replace(/[^\w.\-]/g, "_");
        const path = `${projectId}/${deliverableId}/${crypto.randomUUID()}-${safe}`;
        const { error } = await supabase.storage.from("assets").upload(path, file);
        if (error) {
          alert(`Error subiendo ${file.name}: ${error.message}`);
          continue;
        }
        const { data: pub } = supabase.storage.from("assets").getPublicUrl(path);
        await addAsset(projectId, deliverableId, assetTipo, null, pub.publicUrl);
      }
      await reload();
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function toggle(a: Asset, field: "aprobado" | "publicado") {
    await setAssetFlags(a.id, { [field]: !a[field] });
    reload();
  }
  async function remove(a: Asset) {
    if (confirm("¿Eliminar este archivo?")) {
      await deleteAsset(a.id);
      reload();
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-card)] bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
          {tipo === "D6" ? "Fotos" : "Videos"} ({assets.length})
        </span>
        <label className="cursor-pointer rounded-lg border border-[var(--border-card)] px-3 py-1 text-xs hover:bg-[color-mix(in_srgb,var(--border)_40%,transparent)]">
          {uploading ? "Subiendo…" : `+ Subir ${tipo === "D6" ? "fotos" : "videos"}`}
          <input type="file" accept={accept} multiple hidden onChange={onFile} disabled={uploading} />
        </label>
      </div>

      {assets.length === 0 ? (
        <p className="py-3 text-center text-xs text-muted">
          Genera los prompts arriba, produce los archivos fuera y súbelos aquí.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {assets.map((a) => (
            <div key={a.id} className="overflow-hidden rounded-lg border border-[var(--border-card)]">
              {a.tipo === "foto" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.file_url} alt="asset" className="aspect-square w-full object-cover" />
              ) : (
                <video src={a.file_url} className="aspect-square w-full object-cover" />
              )}
              <div className="flex items-center justify-between gap-1 p-1.5 text-[10px]">
                <button
                  onClick={() => toggle(a, "aprobado")}
                  className={a.aprobado ? "text-[var(--ok)]" : "text-muted hover:text-foreground"}
                >
                  {a.aprobado ? "✓ aprob." : "aprobar"}
                </button>
                <button
                  onClick={() => toggle(a, "publicado")}
                  disabled={!a.aprobado}
                  className={a.publicado ? "text-brand" : "text-muted hover:text-foreground disabled:opacity-40"}
                >
                  {a.publicado ? "● público" : "publicar"}
                </button>
                <button onClick={() => remove(a)} className="text-muted hover:text-[var(--danger)]">
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
