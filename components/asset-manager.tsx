"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";
import {
  addAsset,
  getAssets,
  setAssetFlags,
  deleteAsset,
  generarFoto,
  pollFoto,
  registrarFotoRef,
  getFotosRef,
} from "@/app/(app)/projects/actions";

type Asset = {
  id: string;
  tipo: string;
  categoria: string | null;
  file_url: string | null;
  aprobado: boolean;
  publicado: boolean;
  estado: string;
  prompt: string | null;
};
type RefFoto = { id: string; titulo: string; file_url: string };

const IDENTITY =
  "preserving his/her exact facial features, expression, skin tone and identity, do not alter features. natural skin texture, no beauty filter, no plastic smoothing.";

const QUICK = [
  { key: "autoridad", label: "Autoridad", aspect: "4:5", prompt: "Editorial authority portrait for a personal brand website, seated confidently, warm cinematic studio lighting, refined dark outfit, deep solid backdrop in the brand colors, shallow depth of field, magazine quality." },
  { key: "cercano", label: "Cercano", aspect: "4:5", prompt: "Warm approachable lifestyle portrait, soft natural window light, relaxed genuine expression, clean neutral background, candid personal-brand feel." },
  { key: "contenido", label: "Contenido / redes", aspect: "9:16", prompt: "Dynamic content-creator shot for social media, vertical framing, modern clean background, confident energetic pose, crisp lighting." },
];
const ASPECTS = ["4:5", "3:4", "1:1", "9:16", "16:9", "3:2"];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  const supabase = createClient();

  const [assets, setAssets] = useState<Asset[]>([]);
  useEffect(() => {
    let active = true;
    getAssets(deliverableId).then((d) => active && setAssets(d as unknown as Asset[]));
    return () => {
      active = false;
    };
  }, [deliverableId]);

  async function reload() {
    setAssets((await getAssets(deliverableId)) as unknown as Asset[]);
  }

  // subida manual (fotos/videos ya producidos afuera)
  const [uploading, setUploading] = useState(false);
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
        const url = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
        await addAsset(projectId, deliverableId, assetTipo, null, url);
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
    <div className="space-y-3">
      {tipo === "D6" && (
        <PhotoStudio projectId={projectId} deliverableId={deliverableId} onDone={reload} />
      )}

      <div className="rounded-xl border border-[var(--border-card)] bg-surface p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
            {tipo === "D6" ? "Galería de fotos" : "Videos"} ({assets.length})
          </span>
          <label className="cursor-pointer rounded-lg border border-[var(--border-card)] px-3 py-1 text-xs hover:bg-[color-mix(in_srgb,var(--border)_40%,transparent)]">
            {uploading ? "Subiendo…" : `+ Subir ${tipo === "D6" ? "fotos" : "videos"}`}
            <input type="file" accept={accept} multiple hidden onChange={onFile} disabled={uploading} />
          </label>
        </div>

        {assets.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted">
            {tipo === "D6" ? "Genera fotos con IA arriba, o sube las tuyas." : "Sube los videos producidos afuera."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {assets.map((a) => (
              <div key={a.id} className="overflow-hidden rounded-lg border border-[var(--border-card)]">
                {a.estado === "generando" ? (
                  <div className="grid aspect-square w-full animate-pulse place-items-center bg-subtle text-[10px] text-muted">
                    generando…
                  </div>
                ) : a.estado === "error" || !a.file_url ? (
                  <div className="grid aspect-square w-full place-items-center bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-[10px] text-[var(--danger)]">
                    falló
                  </div>
                ) : a.tipo === "foto" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.file_url} alt="asset" className="aspect-square w-full object-cover" />
                ) : (
                  <video src={a.file_url} className="aspect-square w-full object-cover" />
                )}
                <div className="flex items-center justify-between gap-1 p-1.5 text-[10px]">
                  <button
                    onClick={() => toggle(a, "aprobado")}
                    disabled={a.estado !== "listo"}
                    className={a.aprobado ? "text-[var(--ok)]" : "text-muted hover:text-foreground disabled:opacity-40"}
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
                  <button onClick={() => remove(a)} className="text-muted hover:text-[var(--danger)]">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PhotoStudio({
  projectId,
  deliverableId,
  onDone,
}: {
  projectId: string;
  deliverableId: string;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [refs, setRefs] = useState<RefFoto[]>([]);
  const [selRef, setSelRef] = useState<string>("");
  const [prompt, setPrompt] = useState(QUICK[0].prompt);
  const [categoria, setCategoria] = useState("Autoridad");
  const [aspect, setAspect] = useState("4:5");
  const [resolution, setResolution] = useState("2k");
  const [uploadingRef, setUploadingRef] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getFotosRef(projectId).then((d) => {
      if (!active) return;
      const list = d as RefFoto[];
      setRefs(list);
      if (list[0]) setSelRef(list[0].file_url);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  async function onRef(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setUploadingRef(true);
    try {
      const safe = f.name.replace(/[^\w.\-]/g, "_");
      const path = `${projectId}/ref/${crypto.randomUUID()}-${safe}`;
      const { error } = await supabase.storage.from("assets").upload(path, f);
      if (error) throw new Error(error.message);
      const url = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
      await registrarFotoRef(projectId, url, f.name);
      const list = (await getFotosRef(projectId)) as RefFoto[];
      setRefs(list);
      setSelRef(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo subir");
    } finally {
      setUploadingRef(false);
      e.target.value = "";
    }
  }

  function quick(q: (typeof QUICK)[number]) {
    setPrompt(q.prompt);
    setAspect(q.aspect);
    setCategoria(q.label);
  }

  async function generar() {
    if (!selRef) {
      setMsg("Sube o elige una foto de referencia.");
      return;
    }
    let p = prompt.trim();
    if (!/preserving/i.test(p)) p = `${p} ${IDENTITY}`;
    setGenerating(true);
    setMsg("Enviando…");
    try {
      const { assetId } = await generarFoto({ projectId, deliverableId, refUrl: selRef, prompt: p, aspect, resolution, categoria });
      onDone(); // muestra el tile «generando»
      for (let i = 0; i < 40; i++) {
        await sleep(4000);
        const r = await pollFoto(assetId);
        setMsg(`Generando… ${(i + 1) * 4}s`);
        if (r.estado === "listo") {
          setMsg("Foto lista ✓ — revísala y apruébala abajo.");
          onDone();
          return;
        }
        if (r.estado === "error") {
          setMsg("La generación falló. Reintenta.");
          onDone();
          return;
        }
      }
      setMsg("Tardó demasiado; revisa en un momento.");
      onDone();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo generar");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border-card)] bg-surface p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider text-brand">Sesión de fotos con IA</div>

      {/* foto de referencia */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {refs.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelRef(r.file_url)}
            className={`h-12 w-12 overflow-hidden rounded-lg border-2 ${selRef === r.file_url ? "border-brand" : "border-[var(--border-card)]"}`}
            title={r.titulo}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.file_url} alt={r.titulo} className="h-full w-full object-cover" />
          </button>
        ))}
        <label className="grid h-12 w-12 cursor-pointer place-items-center rounded-lg border border-dashed border-[var(--border-card)] text-lg text-muted hover:bg-subtle">
          {uploadingRef ? "…" : "+"}
          <input type="file" accept="image/*" hidden onChange={onRef} disabled={uploadingRef} />
        </label>
        <span className="text-[10px] text-muted">Foto(s) de referencia del cliente</span>
      </div>

      {/* prompt + quick-start */}
      <div className="mt-2 flex flex-wrap gap-1">
        {QUICK.map((q) => (
          <button
            key={q.key}
            onClick={() => quick(q)}
            className="rounded-full border border-[var(--border-card)] px-2 py-0.5 text-[10px] hover:bg-subtle"
          >
            {q.label}
          </button>
        ))}
      </div>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        className="mt-1.5 h-16 w-full resize-y rounded-lg border border-[var(--border-card)] bg-background p-2 text-xs outline-none focus:border-brand"
      />
      <p className="mt-1 text-[10px] text-muted">Se agrega automáticamente la cláusula de preservación de identidad.</p>

      {/* opciones + generar */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <select value={aspect} onChange={(e) => setAspect(e.target.value)} className="rounded-lg border border-[var(--border-card)] bg-background px-2 py-1 text-xs">
          {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="rounded-lg border border-[var(--border-card)] bg-background px-2 py-1 text-xs">
          {["1k", "2k", "4k"].map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <Button variant="primary" onClick={generar} disabled={generating || !selRef} className="ml-auto">
          {generating ? "Generando…" : "Generar foto"}
        </Button>
      </div>
      {msg && <p className="mt-1.5 text-xs text-secondary">{msg}</p>}
    </div>
  );
}
