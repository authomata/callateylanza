import { createClient } from "@/lib/supabase/server";
import { DashboardGrid, type DashProject } from "./dashboard-grid";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, nombre, estado, clients(nombre, ciudad, rubro), deliverables(tipo, estado, titulo, desbloqueo_manual)")
    .order("created_at", { ascending: false });

  const projects: DashProject[] = (data ?? []).map((p) => {
    const client = (p as unknown as { clients: { nombre: string; ciudad: string | null; rubro: string | null } | null }).clients;
    return {
      id: p.id as string,
      clientName: client?.nombre ?? "—",
      kitName: p.nombre as string,
      ciudad: client?.ciudad ?? null,
      rubro: client?.rubro ?? null,
      estado: p.estado as DashProject["estado"],
      deliverables: (p.deliverables ?? []) as DashProject["deliverables"],
    };
  });

  return <DashboardGrid projects={projects} />;
}
