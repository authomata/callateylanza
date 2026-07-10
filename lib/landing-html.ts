// Extrae la landing REAL (documento HTML5 completo) del contenido de D5.
// El prompt v2 de D5 emite el copy en markdown + un bloque ```html``` con la página lista.
// Si no hay bloque válido, devolvemos null y el deploy cae al render del copy (fallback).
export function extractLandingHtml(md: string | null | undefined): string | null {
  if (!md) return null;
  const matches = [...md.matchAll(/```html\s*([\s\S]*?)```/gi)];
  // recorre desde el último bloque (la landing va al final del documento)
  for (const m of matches.reverse()) {
    const html = m[1].trim();
    if (/^<!doctype\s+html/i.test(html) || /^<html[\s>]/i.test(html)) return html;
  }
  return null;
}
