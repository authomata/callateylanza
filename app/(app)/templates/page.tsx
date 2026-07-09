import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/roles";
import type { ModuleTemplate } from "@/lib/types";
import TemplateEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("module_templates")
    .select("*")
    .order("tipo")
    .order("version", { ascending: false });

  const templates = (data ?? []) as ModuleTemplate[];
  const byTipo = new Map<string, ModuleTemplate[]>();
  for (const t of templates) {
    if (!byTipo.has(t.tipo)) byTipo.set(t.tipo, []);
    byTipo.get(t.tipo)!.push(t);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Plantillas de módulos</h1>
        <p className="text-sm text-muted">
          Prompts como datos: afina cualquier módulo sin deploy. Editar en la versión activa o
          guardar como nueva versión.
        </p>
      </div>
      <div className="space-y-3">
        {[...byTipo.entries()].map(([tipo, versions]) => (
          <TemplateEditor key={tipo} tipo={tipo} versions={versions} />
        ))}
      </div>
    </div>
  );
}
