// Extrae el Documento de Voz estructurado desde el markdown del D0.
// El prompt de D0 emite un bloque ```json``` con lexicon/citas_canon/registro_si_no/lineas_rojas.
// Este parser lo recupera de forma robusta y lo normaliza al shape de voice_docs.

export interface ExtractedVoice {
  lexicon: { expresion: string; significado: string; de_donde_viene: string; como_usarla: string }[];
  citas_canon: { cita: string; contexto: string }[];
  registro_si_no: { si: string[]; no: string[] };
  lineas_rojas: string[];
}

function asArray(x: unknown): unknown[] {
  return Array.isArray(x) ? x : [];
}
function asStr(x: unknown): string {
  return typeof x === "string" ? x : x == null ? "" : String(x);
}

function normalize(o: Record<string, unknown>): ExtractedVoice {
  const reg = (o.registro_si_no ?? {}) as { si?: unknown; no?: unknown };
  return {
    lexicon: asArray(o.lexicon).map((e) => {
      const x = (e ?? {}) as Record<string, unknown>;
      return {
        expresion: asStr(x.expresion),
        significado: asStr(x.significado),
        de_donde_viene: asStr(x.de_donde_viene),
        como_usarla: asStr(x.como_usarla),
      };
    }),
    citas_canon: asArray(o.citas_canon).map((c) => {
      const x = (c ?? {}) as Record<string, unknown>;
      return { cita: asStr(x.cita), contexto: asStr(x.contexto) };
    }),
    registro_si_no: { si: asArray(reg.si).map(asStr), no: asArray(reg.no).map(asStr) },
    lineas_rojas: asArray(o.lineas_rojas).map(asStr),
  };
}

// Busca el bloque ```json``` de voz en el markdown y lo parsea. Devuelve null si no hay uno válido.
export function extractVoiceFromMarkdown(md: string | null | undefined): ExtractedVoice | null {
  if (!md) return null;
  const matches = [...md.matchAll(/```json\s*([\s\S]*?)```/gi)];
  if (matches.length === 0) return null;
  // recorre desde el último bloque (el de la voz suele ir al final del D0)
  for (const m of matches.reverse()) {
    try {
      const obj = JSON.parse(m[1].trim()) as Record<string, unknown>;
      if (obj && (obj.lexicon || obj.citas_canon || obj.registro_si_no || obj.lineas_rojas)) {
        return normalize(obj);
      }
    } catch {
      // sigue con el siguiente candidato
    }
  }
  return null;
}
