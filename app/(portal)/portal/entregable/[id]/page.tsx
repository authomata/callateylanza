import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/roles";
import { DocView } from "@/components/doc-view";
import { DeliverableComments } from "@/components/deliverable-comments";

export const dynamic = "force-dynamic";

export default async function EntregablePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  // RLS: el cliente solo ve sus entregables publicados.
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("tipo, titulo, contenido_md, estado")
    .eq("id", id)
    .maybeSingle();
  if (!d || d.estado !== "publicado") notFound();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link href="/portal" className="text-sm text-muted hover:underline">
          ← Mi Kit
        </Link>
        <a href={`/print/${id}`} target="_blank" className="text-sm text-brand hover:underline">
          Descargar PDF ↗
        </a>
      </div>
      <article className="rounded-xl border border-[var(--border-card)] bg-surface px-8 py-8 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <DocView tipo={d.tipo}>{d.contenido_md ?? ""}</DocView>
      </article>

      <DeliverableComments
        deliverableId={id}
        viewer="cliente"
        titulo="Comentarios sobre este documento"
        nota="Escríbele aquí a Andrés y al equipo. Queda todo en este hilo, junto al documento."
      />
    </div>
  );
}
