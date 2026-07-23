// Extrae los 15 prompts del Banco Visual (D6) para usarlos en la sesión de fotos.
// Ancla robusta: TODO prompt válido lleva la cláusula obligatoria "preserving ...".
export interface VisualPrompt {
  id: string;
  nombre: string;
  categoria: string;
  prompt: string;
}

// aspecto sugerido según la categoría del prompt
export function aspectFor(categoria: string): string {
  return /contenido|redes|social|vertical|reel|story/i.test(categoria) ? "9:16" : "4:5";
}

function lastBoldBefore(text: string): string | null {
  const bolds = [...text.matchAll(/^\s*\*\*(.+?)\*\*\s*$/gm)];
  return bolds.length ? bolds[bolds.length - 1][1].replace(/\*/g, "").trim() : null;
}

function lastHeadingBefore(text: string): string {
  const heads = [...text.matchAll(/^#{2,4}\s+(.+)$/gm)];
  if (!heads.length) return "";
  return heads[heads.length - 1][1].replace(/^\d+\.\s*/, "").trim();
}

export function extractVisualPrompts(md: string | null | undefined): VisualPrompt[] {
  if (!md) return [];
  const out: VisualPrompt[] = [];

  // 1) bloques de código con la cláusula de identidad (formato habitual de D6)
  const fence = /```[a-zA-Z]*\s*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(md)) !== null) {
    const body = m[1].trim();
    if (!/preserving/i.test(body) || body.length < 60) continue;
    const before = md.slice(0, m.index);
    out.push({
      id: `vp${out.length}`,
      nombre: lastBoldBefore(before) ?? `Prompt ${out.length + 1}`,
      categoria: lastHeadingBefore(before),
      prompt: body,
    });
  }
  if (out.length) return out;

  // 2) fallback: párrafos sueltos con la cláusula (por si el modelo no usó bloques)
  const blocks = md.split(/\n\s*\n/);
  blocks.forEach((b, i) => {
    const body = b.replace(/^>\s?/gm, "").trim();
    if (!/preserving/i.test(body) || body.length < 120) return;
    const before = md.slice(0, md.indexOf(b));
    out.push({
      id: `vp${i}`,
      nombre: lastBoldBefore(before) ?? `Prompt ${out.length + 1}`,
      categoria: lastHeadingBefore(before),
      prompt: body,
    });
  });
  return out;
}
