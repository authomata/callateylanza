// Validador anti-slop: detecta andamiaje retórico y muletillas de IA en el texto entregado.
// Lista base: frases-IA prohibidas del Voice DNA (authobrand) + el andamiaje que se filtraba
// desde las reglas de sistema. Bloquea la aprobación, igual que el voseo.

export interface SlopFinding {
  line: number;
  match: string;
  motivo: string;
}

interface Regla {
  frases: string[];
  motivo: string;
}

const REGLAS: Regla[] = [
  {
    motivo: "Regla de sistema filtrada al documento",
    frases: ["regla de oro", "nada inventado", "trazable a los insumos", "vacío a resolver", "vacíos a resolver"],
  },
  {
    motivo: "Etiqueta retórica",
    frases: ["nota honesta", "sin más preámbulos", "dicho esto", "a modo de cierre", "en resumen", "en conclusión", "en definitiva", "en última instancia"],
  },
  {
    motivo: "Muletilla de IA / relleno",
    frases: [
      "es importante destacar", "es importante señalar", "es importante mencionar",
      "cabe destacar", "cabe mencionar", "cabe señalar", "vale la pena mencionar",
      "no cabe duda", "sin lugar a dudas", "es fundamental", "es crucial", "es esencial",
      "la clave está", "la clave es", "ten en cuenta que",
    ],
  },
  {
    motivo: "Cliché de IA",
    frases: ["en el mundo de hoy", "en la era digital", "en un mundo donde", "más que nunca", "el verdadero poder", "la verdadera pregunta", "al siguiente nivel"],
  },
  {
    motivo: "Falsa dicotomía / pre-defensa",
    frases: ["no se trata de", "no se trata solo de", "esto no es solo"],
  },
  {
    motivo: "Hedging (baja certeza)",
    frases: ["en mi opinión", "creo que tal vez", "podría ser que", "quizás sería bueno"],
  },
  {
    motivo: "Lenguaje corporativo genérico",
    frases: ["disruptivo", "sinergia", "hoja de ruta", "transformacional"],
  },
  {
    motivo: "Estética de coach motivacional",
    frases: ["desbloquea tu", "potencia tu", "atrévete a", "tú puedes lograrlo"],
  },
];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ENTRIES = REGLAS.flatMap((r) =>
  r.frases.map((f) => ({
    motivo: r.motivo,
    re: new RegExp(`(?<![\\p{L}])${escapeRegExp(f)}(?![\\p{L}])`, "giu"),
  }))
);

export function findSlop(text: string): SlopFinding[] {
  const findings: SlopFinding[] = [];
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    for (const { re, motivo } of ENTRIES) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(line)) !== null) {
        findings.push({ line: i + 1, match: m[0], motivo });
        if (m.index === re.lastIndex) re.lastIndex++;
      }
    }
  });
  return findings;
}
