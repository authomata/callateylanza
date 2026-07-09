import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin, jsonError } from "@/lib/auth/roles";
import { runValidators, isCleanForApproval } from "@/lib/validators";
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

  let unlocked = false;
  if (d.tipo === "D1") {
    // GATE: D1 approval unlocks D2–D8.
    await supabase
      .from("deliverables")
      .update({ gate_bloqueado: false })
      .eq("project_id", d.project_id)
      .neq("tipo", "D0")
      .neq("tipo", "D1");
    await supabase.from("projects").update({ estado: "en_produccion" }).eq("id", d.project_id);
    unlocked = true;
  }

  await supabase.from("activity_log").insert({
    project_id: d.project_id,
    user_id: user!.id,
    accion: "aprobado",
    detalle: `${d.tipo}${unlocked ? " — desbloquea D2–D8" : ""}`,
  });

  return NextResponse.json({ ok: true, unlocked });
}
