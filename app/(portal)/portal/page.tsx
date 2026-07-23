import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth/roles";
import type { DeliverableTipo } from "@/lib/types";
import { LibrarySection } from "@/components/library-embed";
import { getLandingStatus } from "@/app/actions/landing";
import { LandingCard } from "./landing-card";
import { ContactForm } from "./contact-form";
import { AportesSection } from "./aportes";

export const dynamic = "force-dynamic";

// Los 8 entregables que ve el cliente (D0 es interno).
const KIT: { tipo: DeliverableTipo; nombre: string }[] = [
  { tipo: "D1", nombre: "Manual de marca personal" },
  { tipo: "D2", nombre: "Plan de medios + calendario 60 días" },
  { tipo: "D3", nombre: "Tu oferta y framework" },
  { tipo: "D4", nombre: "Masterclass / Lead magnet" },
  { tipo: "D5", nombre: "Tu landing page" },
  { tipo: "D6", nombre: "Banco visual" },
  { tipo: "D7", nombre: "Tu asistente de contenidos" },
  { tipo: "D8", nombre: "6 videos verticales" },
];

export default async function PortalPage() {
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: clientRow } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("user_id", user!.id)
    .maybeSingle();

  if (!clientRow) {
    return (
      <div className="rounded-xl border border-[var(--border-card)] bg-surface p-8 text-center">
        <h1 className="font-serif text-2xl">Aún no tienes un kit asignado</h1>
        <p className="mt-2 text-sm text-muted">Si crees que es un error, escríbele a Andrés.</p>
      </div>
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("client_id", clientRow.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const landing = project ? await getLandingStatus(project.id) : null;

  const [{ data: pubs }, { data: assets }, { data: library }, { data: mensajes }] = await Promise.all([
    supabase.from("deliverables").select("id, tipo, titulo, publicado_at").eq("estado", "publicado"),
    supabase.from("assets").select("id, tipo, categoria, file_url").eq("publicado", true),
    supabase
      .from("library_items")
      .select("id, seccion, titulo, embed_url, descripcion, orden, activo")
      .eq("activo", true)
      .order("orden"),
    project
      ? supabase
          .from("messages")
          .select("id, texto, de_equipo, created_at")
          .eq("project_id", project.id)
          .order("created_at")
      : Promise.resolve({ data: [] }),
  ]);

  const { data: aportes } = await supabase
    .from("inputs")
    .select("id, titulo, contenido_texto, file_url, created_at")
    .eq("subido_por", user!.id)
    .order("created_at", { ascending: false });

  const byTipo = new Map((pubs ?? []).map((d) => [d.tipo, d]));
  const listos = KIT.filter((k) => byTipo.has(k.tipo)).length;
  const fotos = (assets ?? []).filter((a) => a.tipo === "foto");
  const videos = (assets ?? []).filter((a) => a.tipo === "video");

  return (
    <div className="space-y-8">
      <header>
        <div className="eyebrow">Tu kit de marca</div>
        <h1 className="mt-1 font-serif text-[32px] leading-none">Hola, {clientRow.nombre.split(" ")[0]}</h1>
        <p className="mt-2 text-secondary">Aquí vive todo tu ecosistema de marca. Se irá completando pieza a pieza.</p>
      </header>

      {/* avance */}
      <div className="rounded-xl border border-[var(--border-card)] bg-surface p-4">
        <div className="mb-1.5 flex items-center justify-between text-sm">
          <span className="text-secondary">Avance de tu kit</span>
          <span className="font-mono text-muted">{listos} / 8 listos</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--border)]">
          <div className="h-full rounded-full bg-brand" style={{ width: `${(listos / 8) * 100}%` }} />
        </div>
      </div>

      {/* entregables */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">Entregables</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {KIT.map((k) => {
            const pub = byTipo.get(k.tipo);
            return pub ? (
              <Link
                key={k.tipo}
                href={`/portal/entregable/${pub.id}`}
                className="flex items-center justify-between rounded-xl border border-[var(--border-card)] bg-surface p-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)] transition hover:shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
              >
                <div>
                  <div className="font-medium">{k.nombre}</div>
                  <div className="text-xs text-[var(--ok)]">● Listo · abrir</div>
                </div>
                <span className="text-brand">→</span>
              </Link>
            ) : (
              <div
                key={k.tipo}
                className="flex items-center justify-between rounded-xl border border-dashed border-[var(--border-card)] p-4 opacity-70"
              >
                <div>
                  <div className="font-medium text-secondary">{k.nombre}</div>
                  <div className="text-xs text-muted">En producción</div>
                </div>
                <span className="text-muted">⏳</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* landing */}
      {project && landing && (
        <LandingCard
          projectId={project.id}
          landingUrl={landing.landingUrl}
          owner={landing.owner}
          hasClientToken={landing.hasClientToken}
          hasClientSite={landing.hasClientSite}
        />
      )}

      {/* galería */}
      <section className="space-y-3">
        <h2 className="font-serif text-xl">Galería</h2>
        {fotos.length === 0 && videos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border-card)] p-6 text-center">
            <p className="text-sm text-secondary">Tu sesión de fotos está en producción.</p>
            <p className="mt-1 text-xs text-muted">
              Aquí van a aparecer tus fotos y videos para ver y descargar.
            </p>
          </div>
        ) : (
          <>
            {fotos.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {fotos.map((f) => (
                <a key={f.id} href={f.file_url} target="_blank" className="group relative overflow-hidden rounded-xl border border-[var(--border-card)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.file_url} alt={f.categoria ?? "foto"} className="aspect-square w-full object-cover transition group-hover:scale-105" />
                </a>
              ))}
            </div>
          )}
            {videos.length > 0 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {videos.map((v) => (
                  <video key={v.id} src={v.file_url} controls className="w-full rounded-xl border border-[var(--border-card)]" />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* aporta material */}
      <AportesSection projectId={project?.id ?? null} aportes={(aportes ?? []) as never} />

      {/* biblioteca */}
      <LibrarySection items={library ?? []} />

      {/* conversación */}
      <ContactForm projectId={project?.id ?? null} messages={(mensajes ?? []) as never} />
    </div>
  );
}
