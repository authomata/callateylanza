import type { LibraryItem, LibrarySeccion } from "@/lib/types";

const SECCION_LABEL: Record<LibrarySeccion, string> = {
  onboarding: "Onboarding",
  curso1: "Curso · Profesional del Futuro",
  curso2: "Curso · Podcast en 30 días",
  curso3: "Curso · Videos con IA",
};
const ORDER: LibrarySeccion[] = ["onboarding", "curso1", "curso2", "curso3"];

// Convierte una URL de YouTube/Vimeo a su forma embebible.
export function toEmbed(url: string): string {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vi = url.match(/vimeo\.com\/(\d+)/);
  if (vi) return `https://player.vimeo.com/video/${vi[1]}`;
  return url;
}

export function LibrarySection({ items }: { items: LibraryItem[] }) {
  if (!items || items.length === 0) return null;
  const bySeccion = new Map<string, LibraryItem[]>();
  for (const it of items) {
    if (!bySeccion.has(it.seccion)) bySeccion.set(it.seccion, []);
    bySeccion.get(it.seccion)!.push(it);
  }

  return (
    <section className="space-y-4">
      <h2 className="font-serif text-xl">Biblioteca</h2>
      {ORDER.filter((s) => bySeccion.has(s)).map((seccion) => (
        <div key={seccion} className="space-y-2">
          <div className="eyebrow">{SECCION_LABEL[seccion]}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {bySeccion.get(seccion)!.map((it) => (
              <div key={it.id} className="overflow-hidden rounded-xl border border-[var(--border-card)] bg-surface">
                {it.embed_url && (
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      src={toEmbed(it.embed_url)}
                      title={it.titulo}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                )}
                <div className="p-3">
                  <div className="font-medium">{it.titulo}</div>
                  {it.descripcion && <div className="mt-0.5 text-xs text-muted">{it.descripcion}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
