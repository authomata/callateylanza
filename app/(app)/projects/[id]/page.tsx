import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { PROJECT_ESTADO } from "@/lib/estados";
import ProjectWorkspace from "./workspace";
import { InviteClient } from "./invite-client";
import type { Deliverable, InputRow, ModuleTemplate, VoiceDoc } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser();

  const { data: project } = await supabase
    .from("projects")
    .select("id, nombre, estado, fecha_dia7, clients(nombre, slug, ciudad, rubro, email)")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const [{ data: deliverables }, { data: inputs }, { data: voice }, { data: templates }] =
    await Promise.all([
      supabase.from("deliverables").select("*").eq("project_id", id).order("orden"),
      supabase.from("inputs").select("*").eq("project_id", id).order("created_at", { ascending: false }),
      supabase.from("voice_docs").select("*").eq("project_id", id).single(),
      supabase.from("module_templates").select("tipo, version, nombre, inputs_requeridos, checklist_calidad, activa").eq("activa", true),
    ]);

  const client = (project as unknown as { clients: { nombre: string; ciudad: string | null; rubro: string | null } }).clients;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm text-muted hover:underline">
            ← Proyectos
          </Link>
          <h1 className="mt-1 font-serif text-2xl">
            {client?.nombre}{" "}
            <span className="text-base text-muted">· {project.nombre}</span>
          </h1>
          <p className="text-xs text-muted">
            {[client?.ciudad, client?.rubro].filter(Boolean).join(" · ")} —{" "}
            {PROJECT_ESTADO[project.estado as keyof typeof PROJECT_ESTADO]}
          </p>
        </div>
        {user!.rol === "admin" && <InviteClient projectId={id} />}
      </div>

      <ProjectWorkspace
        projectId={id}
        userRol={user!.rol}
        deliverables={(deliverables ?? []) as Deliverable[]}
        inputs={(inputs ?? []) as InputRow[]}
        voiceDoc={(voice ?? null) as VoiceDoc | null}
        templates={(templates ?? []) as unknown as Pick<ModuleTemplate, "tipo" | "version" | "inputs_requeridos" | "checklist_calidad" | "activa">[]}
      />
    </div>
  );
}
