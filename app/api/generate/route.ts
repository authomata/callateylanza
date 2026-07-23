import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff, jsonError } from "@/lib/auth/roles";
import { createGenerationStream } from "@/lib/anthropic";
import { assembleGeneration } from "@/lib/prompts/assemble";
import { HOUSE_VOICE_DEFAULT } from "@/lib/prompts/house-voice";
import { computeAvailability } from "@/lib/pipeline";
import { extractVoiceFromMarkdown } from "@/lib/voice-extract";
import type { Deliverable, InputRow, ModuleTemplate, VoiceDoc } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!isStaff(user)) return jsonError(401, "No autorizado");

  const { deliverableId, instrucciones, modo, baseContent } = await req.json();
  if (!deliverableId) return jsonError(400, "Falta deliverableId");

  const supabase = await createClient();

  const { data: deliverable } = await supabase
    .from("deliverables")
    .select("*")
    .eq("id", deliverableId)
    .single<Deliverable>();
  if (!deliverable) return jsonError(404, "Entregable no encontrado");

  // Gate por dependencias (DAG). Admin puede saltarlo; desbloqueo_manual también.
  const { data: allDelivs } = await supabase
    .from("deliverables")
    .select("tipo, estado, desbloqueo_manual")
    .eq("project_id", deliverable.project_id);
  const avail = computeAvailability(allDelivs ?? []);
  if (!avail[deliverable.tipo]?.disponible && user!.rol !== "admin") {
    const faltan = avail[deliverable.tipo]?.faltan ?? [];
    return jsonError(423, `Bloqueado: primero aprueba ${faltan.join(", ")}`);
  }

  const { data: template } = await supabase
    .from("module_templates")
    .select("*")
    .eq("tipo", deliverable.tipo)
    .eq("activa", true)
    .single<ModuleTemplate>();
  if (!template) return jsonError(400, `No hay plantilla activa para ${deliverable.tipo}`);

  // Gather inputs.
  const { data: voice } = await supabase
    .from("voice_docs")
    .select("*")
    .eq("project_id", deliverable.project_id)
    .single<VoiceDoc>();

  const required = (template.inputs_requeridos ?? []) as string[];
  let priorDeliverables: Pick<Deliverable, "tipo" | "contenido_md">[] = [];
  if (required.length) {
    const { data: prev } = await supabase
      .from("deliverables")
      .select("tipo, contenido_md")
      .eq("project_id", deliverable.project_id)
      .in("tipo", required);
    priorDeliverables = (prev ?? []) as Pick<Deliverable, "tipo" | "contenido_md">[];
  }

  // D0 reads the raw insumos; downstream modules read approved deliverables + voice.
  let inputs: InputRow[] = [];
  if (deliverable.tipo === "D0") {
    const { data: ins } = await supabase
      .from("inputs")
      .select("*")
      .eq("project_id", deliverable.project_id)
      .order("created_at");
    inputs = (ins ?? []) as InputRow[];
  }

  // Registro de la casa (editable en /templates, sin deploy)
  const { data: hv } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "house_voice")
    .maybeSingle();

  const { system, user: userMsg } = assembleGeneration({
    template,
    voiceDoc: deliverable.tipo === "D0" ? null : voice,
    priorDeliverables,
    inputs,
    instrucciones,
    modo: modo === "ajustar" ? "ajustar" : "nuevo",
    baseContent: typeof baseContent === "string" ? baseContent : null,
    houseVoice: (hv?.value as string) ?? HOUSE_VOICE_DEFAULT,
  });

  await supabase.from("deliverables").update({ estado: "generando" }).eq("id", deliverableId);

  const encoder = new TextEncoder();
  const anthropicStream = createGenerationStream(system, userMsg);

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let acc = "";
      try {
        for await (const event of anthropicStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            acc += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (e) {
        // surface the failure to the client and roll estado back
        await supabase.from("deliverables").update({ estado: deliverable.estado }).eq("id", deliverableId);
        controller.error(e);
        return;
      }

      // persist the generated draft as a new version (append-only history)
      const nextVersion = (deliverable.version_actual ?? 0) + 1;
      await supabase.from("deliverable_versions").insert({
        deliverable_id: deliverableId,
        version: nextVersion,
        contenido_md: acc,
        generado_por: "ia",
        prompt_template_version: template.version,
        instrucciones: instrucciones || null,
        created_by: user!.id,
      });
      await supabase
        .from("deliverables")
        .update({ contenido_md: acc, version_actual: nextVersion, estado: "borrador" })
        .eq("id", deliverableId);
      await supabase.from("activity_log").insert({
        project_id: deliverable.project_id,
        user_id: user!.id,
        accion: "generado",
        detalle: `${deliverable.tipo} v${nextVersion} (plantilla v${template.version})`,
      });

      // D0 puebla el Documento de Voz estructurado (fuente para todas las generaciones).
      if (deliverable.tipo === "D0") {
        const voice = extractVoiceFromMarkdown(acc);
        if (voice) {
          await supabase
            .from("voice_docs")
            .update({ ...voice, updated_at: new Date().toISOString() })
            .eq("project_id", deliverable.project_id);
        }
      }

      controller.close();
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}
