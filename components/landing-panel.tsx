"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { getLandingStatus, getLandingHtml, generarSitio, publicarSitioRepo } from "@/app/actions/landing";
import { SITE_PRESETS } from "@/lib/prompts/site-builder";

type Status = Awaited<ReturnType<typeof getLandingStatus>>;
const PRESETS = SITE_PRESETS.map((p) => ({ key: p.key, nombre: p.nombre }));

export function LandingPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [preset, setPreset] = useState("coach");
  const [instr, setInstr] = useState("");
  const [busy, setBusy] = useState<null | "site" | "publish">(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const s = await getLandingStatus(projectId);
      if (!active) return;
      setStatus(s);
      if (s.preset) setPreset(s.preset);
      if (s.hasSite) setHtml(await getLandingHtml(projectId));
    })();
    return () => {
      active = false;
    };
  }, [projectId]);

  async function reload() {
    const s = await getLandingStatus(projectId);
    setStatus(s);
    if (s.hasSite) setHtml(await getLandingHtml(projectId));
  }

  async function generar() {
    setBusy("site");
    setMsg(null);
    try {
      await generarSitio(projectId, preset, instr);
      setInstr("");
      setMsg("Sitio generado ✓ — revisa la vista previa.");
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo generar");
    } finally {
      setBusy(null);
    }
  }

  async function publicar() {
    setBusy("publish");
    setMsg(null);
    try {
      const r = await publicarSitioRepo(projectId);
      setMsg(`Repo listo: ${r.repoUrl} — el sitio se publica en ~1 min: ${r.url}`);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setBusy(null);
    }
  }

  if (!status) return null;

  return (
    <div className="space-y-3 rounded-xl border border-[var(--border-card)] bg-surface p-4">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Landing</span>

      {/* Diseñar el sitio */}
      <div className="rounded-lg border border-[var(--border-card)] p-3">
        <div className="text-sm font-medium">Diseñar el sitio</div>
        {!status.hasCopy ? (
          <p className="mt-1 text-xs text-[var(--danger)]">Genera primero el copy de D5 (arriba).</p>
        ) : (
          <>
            <p className="mt-0.5 text-xs text-muted">
              Elige un estilo. Opus construye una landing real (Tailwind, paleta de marca, gradientes).
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                value={preset}
                onChange={(e) => setPreset(e.target.value)}
                disabled={busy !== null}
                className="rounded-lg border border-[var(--border-card)] bg-background px-2 py-1.5 text-sm"
              >
                {PRESETS.map((p) => (
                  <option key={p.key} value={p.key}>{p.nombre}</option>
                ))}
              </select>
              <Button variant="primary" onClick={generar} disabled={busy !== null}>
                {busy === "site" ? "Generando… (~1 min)" : status.hasSite ? "Regenerar sitio" : "Generar sitio"}
              </Button>
            </div>
            <input
              value={instr}
              onChange={(e) => setInstr(e.target.value)}
              placeholder="Ajustes (opcional): «hero a pantalla completa», «más oscuro»…"
              className="mt-2 w-full rounded-lg border border-[var(--border-card)] bg-background px-2.5 py-1.5 text-xs outline-none focus:border-brand"
            />
          </>
        )}
      </div>

      {/* Preview */}
      {status.hasSite && html && (
        <div className="overflow-hidden rounded-lg border border-[var(--border-card)]">
          <div className="flex items-center justify-between bg-subtle px-2.5 py-1 text-[10px] text-muted">
            <span>Vista previa</span>
            <button
              onClick={() => {
                const w = window.open("", "_blank");
                if (w) {
                  w.document.write(html);
                  w.document.close();
                }
              }}
              className="text-brand hover:underline"
            >
              Abrir en grande ↗
            </button>
          </div>
          <iframe
            title="Vista previa de la landing"
            srcDoc={html}
            sandbox="allow-scripts allow-popups"
            className="h-[420px] w-full bg-white"
          />
        </div>
      )}

      {/* Publicar como repo */}
      <div className="rounded-lg border border-[var(--border-card)] p-3">
        <div className="text-sm font-medium">Publicar</div>
        <p className="mt-0.5 text-xs text-muted">
          Crea un repo privado (<span className="font-mono">authomata/callateylanza-…</span>) que se
          deploya solo a Netlify. Editable después con Claude Code.
        </p>
        <Button variant="primary" className="mt-2" onClick={publicar} disabled={busy !== null || !status.hasSite}>
          {busy === "publish"
            ? "Publicando…"
            : status.repoUrl
              ? "Actualizar sitio (push al repo)"
              : "Publicar sitio"}
        </Button>
        {!status.hasSite && <p className="mt-1 text-[10px] text-muted">Genera el sitio primero.</p>}

        {(status.repoUrl || status.landingUrl) && (
          <div className="mt-2 space-y-1 text-xs">
            {status.landingUrl && (
              <a href={status.landingUrl} target="_blank" className="block truncate text-brand hover:underline">
                🌐 {status.landingUrl} ↗
              </a>
            )}
            {status.repoUrl && (
              <a href={status.repoUrl} target="_blank" className="block truncate text-secondary hover:underline">
                📦 {status.repoUrl} ↗
              </a>
            )}
          </div>
        )}
      </div>

      {/* Entregar al cliente */}
      {status.repoUrl && (
        <details className="rounded-lg border border-[var(--border-card)] p-3 text-xs">
          <summary className="cursor-pointer font-medium">Entregar al cliente</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-secondary">
            <li>Agrégalo como colaborador del repo (GitHub → Settings → Collaborators).</li>
            <li>El repo trae un <span className="font-mono">CLAUDE.md</span> con su voz de marca: puede
              editar el sitio con Claude Code/Codex sin romper el estilo.</li>
            <li>Para llevarlo a su Netlify: el <span className="font-mono">README.md</span> tiene los pasos
              (crear cuenta → token → reemplazar los 2 secrets del repo).</li>
          </ol>
        </details>
      )}

      {msg && <p className="break-all text-xs text-secondary">{msg}</p>}
    </div>
  );
}
