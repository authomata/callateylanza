import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/roles";
import type { CitaCanon, VoiceDoc } from "@/lib/types";
import PrintButton from "./print-button";

export const dynamic = "force-dynamic";

const DELIVERABLE_NUM: Record<string, string> = {
  D1: "1", D2: "2", D3: "3", D4: "4", D5: "5", D6: "6", D7: "7", D8: "8", D0: "0",
};

export default async function PrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  // RLS decide la visibilidad: staff ve todo; el cliente solo sus entregables publicados.
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("tipo, titulo, contenido_md, project_id")
    .eq("id", id)
    .single();
  if (!d) notFound();

  const { data: project } = await supabase
    .from("projects")
    .select("nombre, clients(nombre)")
    .eq("id", d.project_id)
    .single();
  const { data: voice } = await supabase
    .from("voice_docs")
    .select("citas_canon")
    .eq("project_id", d.project_id)
    .single<Pick<VoiceDoc, "citas_canon">>();

  const clientName =
    (project as unknown as { clients: { nombre: string } | null })?.clients?.nombre ?? "Cliente";
  const canon = (voice?.citas_canon as CitaCanon[] | undefined)?.[0]?.cita ?? "";

  return (
    <div className="mx-auto max-w-[820px] bg-white px-10 py-12 text-[#1a1a1a] print:px-0 print:py-0">
      <style>{`
        @page { margin: 22mm 18mm; }
        @media print { .no-print { display: none !important; } body { background: #fff; } }
      `}</style>

      <div className="no-print mb-6 flex justify-end">
        <PrintButton />
      </div>

      {/* Portada */}
      <div className="mb-10 border-b-2 border-[#bc5b34] pb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bc5b34]">
          Cállate y Lanza · Entregable {DELIVERABLE_NUM[d.tipo] ?? d.tipo}
        </div>
        <h1 className="mt-3 text-3xl font-bold">{d.titulo}</h1>
        <div className="mt-1 text-lg text-[#555]">{clientName}</div>
        {canon && (
          <blockquote className="mt-6 border-l-4 border-[#1f6b4c] pl-4 text-lg italic text-[#333]">
            “{canon}”
          </blockquote>
        )}
        <div className="mt-6 text-xs font-medium uppercase tracking-widest text-[#b3261e]">
          Documento de trabajo · Confidencial
        </div>
      </div>

      {/* Contenido */}
      <article className="doc">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {d.contenido_md || "*Este entregable aún no tiene contenido.*"}
        </ReactMarkdown>
      </article>

      {/* Pie */}
      <footer className="mt-12 border-t border-[#e6e3dd] pt-4 text-xs text-[#888]">
        Andrés Bustamante · andres@authomata.io · @neurobustamante
      </footer>
    </div>
  );
}
