"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import {
  getLandingStatus,
  getLandingHtml,
  generarSitio,
  deployLandingAndres,
  deployLandingCliente,
} from "@/app/actions/landing";
import { SITE_PRESETS } from "@/lib/prompts/site-builder";

type Status = Awaited<ReturnType<typeof getLandingStatus>>;
const PRESETS = SITE_PRESETS.map((p) => ({ key: p.key, nombre: p.nombre }));

export function LandingPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [preset, setPreset] = useState("coach");
  const [instr, setInstr] = useState("");
  const [busy, setBusy] = useState<null | "site" | "andres" | "cliente">(null);
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

  async function publicar(fn: typeof deployLandingAndres, tipo: "andres" | "cliente") {
    setBusy(tipo);
    setMsg(null);
    try {
      const url = await fn(projectId);
      setMsg(`Publicado: ${url}`);
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
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">Landing</span>
        {status.landingUrl && (
          <span className="text-[10px] text-muted">
            En la cuenta de{" "}
            <strong className={status.owner === "cliente" ? "text-[var(--ok)]" : "text-brand"}>
              {status.owner === "cliente" ? "el cliente" : "Andrés"}
            </strong>
          </span>
        )}
      </div>

      {/* Paso 0 — diseñar el sitio */}
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
              placeholder="Ajustes (opcional): «hero a pantalla completa», «más oscuro», «foco en la oferta»…"
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

      {/* URL publicada */}
      {status.landingUrl && (
        <a
          href={status.landingUrl}
          target="_blank"
          className="block truncate rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm text-brand hover:underline"
        >
          {status.landingUrl} ↗
        </a>
      )}

      {/* Paso 1 — publicar en la cuenta de Andrés */}
      <div className="rounded-lg border border-[var(--border-card)] p-3">
        <div className="text-sm font-medium">Paso 1 · Publicar ya</div>
        <p className="mt-0.5 text-xs text-muted">A la cuenta Netlify de Andrés, para mostrarla al instante.</p>
        <Button
          variant="primary"
          className="mt-2"
          onClick={() => publicar(deployLandingAndres, "andres")}
          disabled={busy !== null || !status.hasSite}
        >
          {busy === "andres" ? "Publicando…" : status.hasStagingSite ? "Re-publicar" : "Publicar ahora"}
        </Button>
        {!status.hasSite && <p className="mt-1 text-[10px] text-muted">Genera el sitio primero.</p>}
      </div>

      {/* Paso 2 — traspaso al cliente */}
      <div className="rounded-lg border border-[var(--border-card)] p-3">
        <div className="text-sm font-medium">Paso 2 · Traspasar al cliente</div>
        {status.hasClientToken ? (
          <>
            <p className="mt-0.5 text-xs text-[var(--ok)]">El cliente ya conectó su Netlify.</p>
            <Button
              variant="secondary"
              className="mt-2"
              onClick={() => publicar(deployLandingCliente, "cliente")}
              disabled={busy !== null || !status.hasSite}
            >
              {busy === "cliente" ? "Traspasando…" : status.hasClientSite ? "Re-deployar en su cuenta" : "Traspasar a su cuenta"}
            </Button>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            El cliente conecta su Netlify desde su portal; ahí se habilita el traspaso.
          </p>
        )}
      </div>

      {msg && <p className="break-all text-xs text-secondary">{msg}</p>}
    </div>
  );
}
