// Validador de voseo (spec §7.1). Regla editorial 5: español de Chile, tuteo.
// Curated list of Argentine (voseo/lunfardo) forms → Chilean tuteo equivalent.
// We use an explicit list rather than a broad heuristic on purpose: a blanket "\wá\b" regex would
// flag valid Chilean future/preterite forms (será, hablará, llegó→no). Accented voseo imperatives
// (mirá, anotá, pará) are distinct from their tú forms, so listing them is safe.

export const VOSEO_MAP: Record<string, string> = {
  // pronombres / cópula
  vos: "tú",
  sos: "eres",
  // presente voseo (-ás/-és/-ís acentuado)
  tenés: "tienes", podés: "puedes", querés: "quieres", sabés: "sabes",
  hacés: "haces", decís: "dices", ponés: "pones", venís: "vienes",
  salís: "sales", vivís: "vives", sentís: "sientes", pedís: "pides",
  seguís: "sigues", elegís: "eliges", preferís: "prefieres", creés: "crees",
  entendés: "entiendes", conocés: "conoces", volvés: "vuelves",
  // imperativos voseo (acento final)
  mirá: "mira", pensá: "piensa", escuchá: "escucha", anotá: "anota",
  contá: "cuenta", dejá: "deja", esperá: "espera", tomá: "toma",
  andá: "anda", pará: "para", agarrá: "agarra", buscá: "busca",
  llevá: "lleva", mandá: "manda", probá: "prueba", usá: "usa",
  llamá: "llama", preguntá: "pregunta", cerrá: "cierra", mostrá: "muestra",
  guardá: "guarda", revisá: "revisa", armá: "arma", fijate: "fíjate",
  vení: "ven", poné: "pon", salí: "sal", decime: "dime", mirame: "mírame",
  // léxico rioplatense
  acá: "aquí", laburo: "trabajo", laburar: "trabajar", pibe: "chico", pibes: "chicos",
};

export interface VoseoFinding {
  line: number; // 1-based
  match: string; // exact matched text
  suggestion: string; // Chilean replacement, capitalization preserved
}

function preserveCase(source: string, replacement: string): string {
  if (source.length > 0 && source[0] === source[0].toUpperCase() && source[0] !== source[0].toLowerCase()) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// Build one regex per form with unicode-aware word boundaries.
const ENTRIES = Object.entries(VOSEO_MAP)
  .map(([form, repl]) => ({
    form,
    repl,
    re: new RegExp(`(?<![\\p{L}])${escapeRegExp(form)}(?![\\p{L}])`, "giu"),
  }));

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Scan text; return every voseo occurrence with its line and suggested fix.
export function findVoseo(text: string): VoseoFinding[] {
  const findings: VoseoFinding[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const { re, repl } of ENTRIES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        findings.push({
          line: i + 1,
          match: m[0],
          suggestion: preserveCase(m[0], repl),
        });
        if (m.index === re.lastIndex) re.lastIndex++; // guard against zero-width loops
      }
    }
  });
  return findings;
}

// Apply every correction to the text (used by the one-click "corregir todo").
export function autoCorrectVoseo(text: string): string {
  let out = text;
  for (const { re, repl } of ENTRIES) {
    out = out.replace(re, (matched) => preserveCase(matched, repl));
  }
  return out;
}

export function hasVoseo(text: string): boolean {
  return ENTRIES.some(({ re }) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}
