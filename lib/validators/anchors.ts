// Validador de anclas (spec §7.2) para D2/D8: cada pieza debe partir de un Ancla no vacía.
export interface AnchorReport {
  ok: boolean;
  total: number;
  vacias: number;
  message: string;
}

// Busca etiquetas "Ancla:" (con o sin markdown/viñeta) y verifica que tengan contenido.
export function checkAnchors(text: string): AnchorReport {
  const re = /(?:^|\n)\s*(?:[-*]\s*)?\*{0,2}Ancla\*{0,2}\s*[:：]\s*(.*)/gi;
  let m: RegExpExecArray | null;
  let total = 0;
  let vacias = 0;
  while ((m = re.exec(text)) !== null) {
    total++;
    const val = (m[1] ?? "").replace(/[*_>#\s]/g, "");
    if (val.length === 0) vacias++;
  }
  if (total === 0) {
    return {
      ok: false,
      total: 0,
      vacias: 0,
      message:
        "No se detectaron 'Ancla:' en las piezas. Cada pieza debe partir de un hecho o historia real del cliente.",
    };
  }
  if (vacias > 0) {
    return { ok: false, total, vacias, message: `${vacias} de ${total} anclas están vacías.` };
  }
  return { ok: true, total, vacias: 0, message: `${total} anclas presentes.` };
}
