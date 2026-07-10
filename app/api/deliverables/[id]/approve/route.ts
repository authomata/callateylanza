import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin, jsonError } from "@/lib/auth/roles";
import { runValidators, isCleanForApproval } from "@/lib/validators";
import { notifyRole, appOrigin } from "@/lib/email";
import type { Deliverable } from "@/lib/types";

export const runtime = "nodejs";

// The human gate. Admin-only. Enforces voseo (and length for D7) before approval.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!isAdmin(user)) return jsonError(403, "Solo un admin puede aprobar");

  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("*")
    .eq("id", id)
    .single<Deliverable>();
  if (!d) return jsonError(404, "Entregable no encontrado");

  if (d.estado !== "listo_para_revision") {
    return jsonError(409, "El entregable debe estar 'listo para revisión' para aprobarse");
  }

  // hard validators
  const report = runValidators(d.tipo, d.contenido_md ?? "");
  if (!isCleanForApproval(report)) {
    return NextResponse.json(
      {
        error:
          report.voseo.length > 0
            ? `Hay ${report.voseo.length} forma(s) de voseo sin corregir`
            : `El documento excede el largo máximo`,
        voseo: report.voseo,
        length: report.length,
      },
      { status: 422 }
    );
  }

  // approve — the enforce_approval_gate trigger validates the approver is an admin
  const { error: upErr } = await supabase
    .from("deliverables")
    .update({ estado: "aprobado", aprobado_por: user!.id, aprobado_at: new Date().toISOString() })
    .eq("id", id);
  if (upErr) return jsonError(400, upErr.message);

  // La disponibilidad de los siguientes entregables se recomputa sola (DAG).
  if (d.tipo === "D1") {
    await supabase.from("projects").update({ estado: "en_produccion" }).eq("id", d.project_id);
  }

  await supabase.from("activity_log").insert({
    project_id: d.project_id,
    user_id: user!.id,
    accion: "aprobado",
    detalle: d.tipo,
  });

  // Aviso al operador (campanita + email).
  await supabase.from("notifications").insert({
    target_rol: "operador",
    project_id: d.project_id,
    deliverable_id: d.id,
    tipo: "aprobado",
    texto: `Andrés aprobó ${d.tipo} — ${d.titulo}. Ya puedes seguir con lo que se habilite.`,
  });

  const origin = await appOrigin();
  await notifyRole("operador", `Aprobado: ${d.tipo} — ${d.titulo}`, {
    titulo: "Andrés aprobó un entregable",
    cuerpo:
      `<p><strong>${d.tipo} — ${d.titulo}</strong> quedó aprobado.</p>` +
      (d.tipo === "D1"
        ? `<p>Con el Manual Maestro aprobado se habilita la siguiente etapa del camino.</p>`
        : `<p>Revisa el camino: puede que se haya habilitado un paso nuevo.</p>`),
    ctaUrl: `${origin}/projects/${d.project_id}`,
    ctaText: "Abrir el proyecto",
  });

  return NextResponse.json({ ok: true, tipo: d.tipo, unlocked: d.tipo === "D1" });
}
