import { GLOBAL_RULES } from "./global-rules";
import type { ModuleTemplate, VoiceDoc, Deliverable, InputRow } from "@/lib/types";

export interface AssembleArgs {
  template: ModuleTemplate;
  voiceDoc?: VoiceDoc | null;
  priorDeliverables?: Pick<Deliverable, "tipo" | "contenido_md">[];
  inputs?: InputRow[]; // raw insumos — used by D0
  d0Content?: string | null; // D0 materia prima — used by D1+
  instrucciones?: string | null; // operator's free-text extra instructions
  modo?: "nuevo" | "ajustar"; // ajustar = evoluciona el documento actual
  baseContent?: string | null; // documento actual (para modo ajustar)
  houseVoice?: string | null; // registro de la casa (cómo se escribe)
}

// El registro de la casa va SIEMPRE en el system, junto a las reglas globales.
function systemBase(a: AssembleArgs): string {
  return `${a.template.prompt_sistema}\n\n---\n${GLOBAL_RULES}` +
    (a.houseVoice?.trim() ? `\n\n---\n${a.houseVoice.trim()}` : "");
}

// Only the fields we want to expose to the model (keeps ids/timestamps out of the prompt).
function voiceForPrompt(v: VoiceDoc) {
  return {
    lexicon: v.lexicon,
    citas_canon: v.citas_canon,
    registro_si_no: v.registro_si_no,
    lineas_rojas: v.lineas_rojas,
  };
}

// Assembles the { system, user } pair for an Anthropic call (spec §7).
export function assembleGeneration(a: AssembleArgs): { system: string; user: string } {
  // MODO AJUSTE: evoluciona el documento actual en vez de rehacerlo.
  if (a.modo === "ajustar" && a.baseContent?.trim()) {
    const system =
      `${systemBase(a)}\n\n---\n` +
      `MODO AJUSTE (importante): NO rehagas el documento desde cero. Parte del DOCUMENTO ACTUAL de abajo y aplica ÚNICAMENTE los ajustes pedidos. Conserva su estructura, sus secciones, sus ejemplos, sus citas y todo lo que ya funciona; cambia solo lo necesario. Devuelve el documento COMPLETO ya ajustado (no un fragmento ni un resumen de cambios).`;
    const parts: string[] = [`# DOCUMENTO ACTUAL (ajústalo, no lo rehagas)\n${a.baseContent}`];
    if (a.instrucciones?.trim()) parts.push(`# AJUSTES PEDIDOS\n${a.instrucciones.trim()}`);
    if (a.voiceDoc) {
      parts.push(
        "# DOCUMENTO DE VOZ (mantén esta voz al ajustar)\n```json\n" +
          JSON.stringify(voiceForPrompt(a.voiceDoc), null, 2) +
          "\n```"
      );
    }
    return { system, user: parts.join("\n\n") };
  }

  const system =
    systemBase(a) +
    (a.template.estructura_output
      ? `\n\n---\nESTRUCTURA ESPERADA DEL OUTPUT:\n${a.template.estructura_output}`
      : "");

  const parts: string[] = [];

  if (a.voiceDoc) {
    parts.push(
      "# DOCUMENTO DE VOZ\n```json\n" +
        JSON.stringify(voiceForPrompt(a.voiceDoc), null, 2) +
        "\n```"
    );
  }

  for (const d of a.priorDeliverables ?? []) {
    if (d.contenido_md) parts.push(`# ENTREGABLE ${d.tipo} (aprobado)\n${d.contenido_md}`);
  }

  if (a.d0Content) parts.push(`# MATERIA PRIMA (D0)\n${a.d0Content}`);

  if (a.inputs?.length) {
    parts.push(
      "# INSUMOS\n" +
        a.inputs
          .map(
            (i) =>
              `## [${i.tipo}] ${i.titulo}\n${
                i.contenido_texto ?? `(archivo adjunto: ${i.file_url ?? "sin url"})`
              }`
          )
          .join("\n\n")
    );
  }

  if (a.instrucciones?.trim()) {
    parts.push(`# INSTRUCCIONES ADICIONALES DEL OPERADOR\n${a.instrucciones.trim()}`);
  }

  return {
    system,
    user:
      parts.join("\n\n") ||
      "(No hay insumos cargados. Indica al operador que suba transcripciones y conclusiones antes de generar.)",
  };
}
