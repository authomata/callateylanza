import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Button, Card } from "@/components/ui";
import { CLIENT_DELIVERABLES, PROJECT_ESTADO, daysUntil } from "@/lib/estados";
import type { DeliverableEstado } from "@/lib/types";

export const dynamic = "force-dynamic";

interface ProjectRow {
  id: string;
  nombre: string;
  estado: keyof typeof PROJECT_ESTADO;
  fecha_dia7: string | null;
  clients: { nombre: string; slug: string } | null;
  deliverables: { tipo: string; estado: DeliverableEstado }[];
}

function Dia7Chip({ dia7 }: { dia7: string | null }) {
  const d = daysUntil(dia7);
  if (d === null) return <span className="text-muted">—</span>;
  const urgent = d <= 2;
  const color = d < 0 ? "#b3261e" : urgent ? "#b5651d" : "#9a978f";
  const label = d < 0 ? `Landing +${-d}d vencida` : d === 0 ? "Landing hoy" : `Landing en ${d}d`;
  return <Badge label={label} color={color} />;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("projects")
    .select("id, nombre, estado, fecha_dia7, clients(nombre, slug), deliverables(tipo, estado)")
    .order("created_at", { ascending: false });

  const projects = (data ?? []) as unknown as ProjectRow[];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-sm text-muted">Estado de producción de cada kit.</p>
        </div>
        <Link href="/projects/new">
          <Button variant="primary">+ Nuevo proyecto</Button>
        </Link>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">Cliente / proyecto</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Avance</th>
              <th className="px-4 py-3 font-medium">Landing</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  Aún no hay proyectos. Crea el primero.
                </td>
              </tr>
            )}
            {projects.map((p) => {
              const aprobados = p.deliverables.filter(
                (d) => CLIENT_DELIVERABLES.includes(d.tipo as (typeof CLIENT_DELIVERABLES)[number]) &&
                  (d.estado === "aprobado" || d.estado === "publicado")
              ).length;
              return (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-[color-mix(in_srgb,var(--border)_25%,transparent)]">
                  <td className="px-4 py-3">
                    <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                      {p.clients?.nombre ?? "—"}
                    </Link>
                    <div className="text-xs text-muted">{p.nombre}</div>
                  </td>
                  <td className="px-4 py-3 text-muted">{PROJECT_ESTADO[p.estado]}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-border">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${(aprobados / 8) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">{aprobados}/8</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Dia7Chip dia7={p.fecha_dia7} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/projects/${p.id}`} className="text-brand hover:underline">
                      Abrir →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
