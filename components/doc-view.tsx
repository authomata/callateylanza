import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Etiqueta editorial por módulo (aparece en el eyebrow del documento).
export const DOC_SUBTITLE: Record<string, string> = {
  D0: "Materia prima & voz",
  D1: "Fuente de verdad",
  D2: "Motor de contenido",
  D3: "Oferta & framework",
  D4: "Masterclass",
  D5: "Landing",
  D6: "Banco visual",
  D7: "Asistente",
  D8: "Video",
};

// Renderiza el output como DOCUMENTO maquetado (no markdown crudo): eyebrow + cuerpo editorial.
export function DocView({
  tipo,
  children,
  className = "",
}: {
  tipo?: string;
  children: string;
  className?: string;
}) {
  const subtitle = tipo ? DOC_SUBTITLE[tipo] : undefined;
  return (
    <article className={`doc ${className}`}>
      <div className="eyebrow mb-3">Cállate y Lanza{subtitle ? ` · ${subtitle}` : ""}</div>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children || "*Sin contenido.*"}</ReactMarkdown>
    </article>
  );
}
