"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { updateMyName } from "../../actions";

export function ProfileForm({ nombre, email }: { nombre: string; email: string }) {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState(nombre);
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState<string | null>(null);

  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState<string | null>(null);

  async function saveName() {
    if (savingName) return;
    setSavingName(true);
    setNameMsg(null);
    try {
      await updateMyName(name);
      setNameMsg("Nombre actualizado ✓");
      router.refresh();
    } catch (e) {
      setNameMsg(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (savingPass) return;
    setPassMsg(null);
    if (pass.length < 8) {
      setPassMsg("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (pass !== pass2) {
      setPassMsg("Las contraseñas no coinciden.");
      return;
    }
    setSavingPass(true);
    const { error } = await supabase.auth.updateUser({ password: pass });
    setSavingPass(false);
    if (error) {
      setPassMsg(`Error: ${error.message}`);
      return;
    }
    setPass("");
    setPass2("");
    setPassMsg("Contraseña actualizada ✓");
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="mb-3 font-serif text-lg">Tus datos</div>
        <label className="block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Email</span>
          <input
            value={email}
            readOnly
            className="w-full cursor-not-allowed rounded-lg border border-[var(--border-card)] bg-subtle px-3 py-2 text-sm text-muted"
          />
          <span className="mt-1 block text-[10px] text-muted">
            Para cambiar tu email, escríbele a Andrés.
          </span>
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wider text-muted">Nombre</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={saveName} disabled={savingName || name.trim() === nombre}>
            {savingName ? "Guardando…" : "Guardar nombre"}
          </Button>
          {nameMsg && <span className="text-xs text-secondary">{nameMsg}</span>}
        </div>
      </Card>

      <Card className="p-5">
        <div className="mb-3 font-serif text-lg">Cambiar contraseña</div>
        <div className="space-y-2">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="Nueva contraseña (mín. 8 caracteres)"
            className="w-full rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
          <input
            type="password"
            value={pass2}
            onChange={(e) => setPass2(e.target.value)}
            placeholder="Repite la nueva contraseña"
            className="w-full rounded-lg border border-[var(--border-card)] bg-background px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="primary" onClick={savePassword} disabled={savingPass || !pass}>
            {savingPass ? "Guardando…" : "Actualizar contraseña"}
          </Button>
          {passMsg && <span className="text-xs text-secondary">{passMsg}</span>}
        </div>
      </Card>
    </div>
  );
}
