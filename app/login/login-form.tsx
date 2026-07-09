"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui";

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/dashboard";

  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  async function onMagic(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setLoading(false);
    setStatus(error ? `Error: ${error.message}` : "Te enviamos un enlace de acceso. Revisa tu correo.");
  }

  async function onPassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setStatus(`Error: ${error.message}`);
    else router.push(next);
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-8">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
            Cállate y Lanza
          </div>
          <h1 className="mt-1 text-xl font-bold">Ingresar</h1>
          <p className="mt-1 text-sm text-muted">Panel de producción de kits de marca.</p>
        </div>

        <form onSubmit={mode === "magic" ? onMagic : onPassword} className="space-y-3">
          <input
            type="email"
            required
            placeholder="tu@correo.cl"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
          {mode === "password" && (
            <input
              type="password"
              required
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand"
            />
          )}
          <Button type="submit" variant="primary" className="w-full" disabled={loading}>
            {loading ? "…" : mode === "magic" ? "Enviar enlace mágico" : "Entrar"}
          </Button>
        </form>

        <button
          onClick={() => {
            setMode(mode === "magic" ? "password" : "magic");
            setStatus(null);
          }}
          className="mt-4 text-xs text-muted underline underline-offset-2 hover:text-foreground"
        >
          {mode === "magic" ? "Usar contraseña" : "Usar enlace mágico"}
        </button>

        {status && <p className="mt-4 text-sm text-foreground">{status}</p>}
      </div>
    </div>
  );
}
