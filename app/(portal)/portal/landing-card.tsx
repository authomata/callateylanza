"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui";
import { saveClientNetlifyToken, deployLandingCliente } from "@/app/actions/landing";

interface Props {
  projectId: string;
  landingUrl: string | null;
  owner: string | null;
  hasClientToken: boolean;
  hasClientSite: boolean;
}

export function LandingCard({ projectId, landingUrl, owner, hasClientToken, hasClientSite }: Props) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState<null | "save" | "deploy">(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  async function conectar() {
    setBusy("save");
    setMsg(null);
    try {
      await saveClientNetlifyToken(projectId, token);
      setToken("");
      setShowForm(false);
      setMsg("Cuenta conectada ✓");
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo conectar");
    } finally {
      setBusy(null);
    }
  }

  async function publicar() {
    setBusy("deploy");
    setMsg(null);
    try {
      const url = await deployLandingCliente(projectId);
      setMsg(`¡Listo! Tu landing vive en ${url}`);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "No se pudo publicar");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border border-[var(--border-card)] bg-surface p-5">
      <h2 className="font-serif text-xl">Tu landing</h2>

      {landingUrl ? (
        <p className="mt-1 text-sm text-secondary">
          Ya está en línea:{" "}
          <a href={landingUrl} target="_blank" className="text-brand hover:underline">
            {landingUrl} ↗
          </a>
          {owner === "andres" && (
            <span className="mt-1 block text-xs text-muted">
              Hoy vive en la cuenta de Andrés. Conecta tu propio Netlify para que quede a tu nombre.
            </span>
          )}
          {owner === "cliente" && (
            <span className="mt-1 block text-xs text-[var(--ok)]">
              Está en tu cuenta de Netlify. Es toda tuya.
            </span>
          )}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">Aún estamos preparando tu landing.</p>
      )}

      {/* conectar Netlify */}
      {!hasClientToken ? (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--border-card)] bg-subtle p-3">
          <div className="text-sm font-medium">Pásala a tu cuenta (gratis, 3 minutos)</div>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-secondary">
            <li>
              Crea una cuenta gratuita en{" "}
              <a href="https://app.netlify.com/signup" target="_blank" className="text-brand hover:underline">
                netlify.com
              </a>
              .
            </li>
            <li>
              Entra a{" "}
              <a href="https://app.netlify.com/user/applications#personal-access-tokens" target="_blank" className="text-brand hover:underline">
                User settings → Applications → Personal access tokens
              </a>
              .
            </li>
            <li>Presiona <strong>New access token</strong>, ponle un nombre y cópialo.</li>
            <li>Pégalo aquí abajo. Tu landing se publicará en tu propia cuenta.</li>
          </ol>

          {showForm ? (
            <div className="mt-3 space-y-2">
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Pega aquí tu token de Netlify"
                className="w-full rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm outline-none focus:border-brand"
              />
              <div className="flex gap-2">
                <Button variant="primary" onClick={conectar} disabled={busy !== null || !token.trim()}>
                  {busy === "save" ? "Conectando…" : "Conectar mi Netlify"}
                </Button>
                <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
              </div>
              <p className="text-[10px] text-muted">
                Guardamos tu token en el servidor y solo lo usamos para publicar tu landing. Puedes
                revocarlo desde Netlify cuando quieras.
              </p>
            </div>
          ) : (
            <Button variant="secondary" className="mt-3" onClick={() => setShowForm(true)}>
              Ya tengo mi token
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-[var(--border-card)] p-3">
          <p className="text-xs text-[var(--ok)]">✓ Tu cuenta de Netlify está conectada.</p>
          <Button variant="primary" className="mt-2" onClick={publicar} disabled={busy !== null}>
            {busy === "deploy"
              ? "Publicando…"
              : hasClientSite
                ? "Actualizar mi landing"
                : "Publicar en mi cuenta"}
          </Button>
        </div>
      )}

      {msg && <p className="mt-3 break-all text-xs text-secondary">{msg}</p>}
    </section>
  );
}
