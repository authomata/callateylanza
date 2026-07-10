"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { getLandingStatus, deployLandingAndres, deployLandingCliente } from "@/app/actions/landing";

type Status = Awaited<ReturnType<typeof getLandingStatus>>;

export function LandingPanel({ projectId }: { projectId: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState<null | "andres" | "cliente">(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLandingStatus(projectId).then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, [projectId]);

  async function reload() {
    setStatus(await getLandingStatus(projectId));
  }

  async function publicarAndres() {
    setBusy("andres");
    setMsg(null);
    try {
      const url = await deployLandingAndres(projectId);
      setMsg(`Publicada: ${url}`);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setBusy(null);
    }
  }

  async function traspasar() {
    setBusy("cliente");
    setMsg(null);
    try {
      const url = await deployLandingCliente(projectId);
      setMsg(`Traspasada a la cuenta del cliente: ${url}`);
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo traspasar");
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
            URL vigente en la cuenta de{" "}
            <strong className={status.owner === "cliente" ? "text-[var(--ok)]" : "text-brand"}>
              {status.owner === "cliente" ? "el cliente" : "Andrés"}
            </strong>
          </span>
        )}
      </div>

      {status.landingUrl && (
        <a
          href={status.landingUrl}
          target="_blank"
          className="block truncate rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm text-brand hover:underline"
        >
          {status.landingUrl} ↗
        </a>
      )}

      {/* Paso 1 */}
      <div className="rounded-lg border border-[var(--border-card)] p-3">
        <div className="text-sm font-medium">Paso 1 · Publicar ya</div>
        <p className="mt-0.5 text-xs text-muted">
          Se deploya a la cuenta Netlify de Andrés para que puedas mostrársela de inmediato.
        </p>
        <Button variant="primary" className="mt-2" onClick={publicarAndres} disabled={busy !== null}>
          {busy === "andres" ? "Publicando…" : status.hasStagingSite ? "Re-publicar" : "Publicar ahora"}
        </Button>
      </div>

      {/* Paso 2 */}
      <div className="rounded-lg border border-[var(--border-card)] p-3">
        <div className="text-sm font-medium">Paso 2 · Traspasar al cliente</div>
        {status.hasClientToken ? (
          <>
            <p className="mt-0.5 text-xs text-[var(--ok)]">
              El cliente ya conectó su cuenta de Netlify.
            </p>
            <Button variant="secondary" className="mt-2" onClick={traspasar} disabled={busy !== null}>
              {busy === "cliente" ? "Traspasando…" : status.hasClientSite ? "Re-deployar en su cuenta" : "Traspasar a su cuenta"}
            </Button>
          </>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            El cliente aún no conectó su Netlify. Lo hace desde su portal, en la tarjeta
            «Tu landing». Cuando lo haga, aquí se habilita el traspaso.
          </p>
        )}
      </div>

      {msg && <p className="break-all text-xs text-secondary">{msg}</p>}
    </div>
  );
}
