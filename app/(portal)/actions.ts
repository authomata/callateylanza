"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/roles";
import { notifyRole, notifyEmail, appOrigin } from "@/lib/email";

// El usuario actualiza su propio nombre. Usa service role tras verificar identidad,
// para no abrir una policy de UPDATE amplia sobre users/clients.
export async function updateMyName(nombre: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No autorizado");
  const n = nombre.trim();
  if (!n) throw new Error("El nombre no puede quedar vacío");

  const admin = createAdminClient();
  await admin.from("users").update({ nombre: n }).eq("id", user.id);
  if (user.rol === "cliente") {
    await admin.from("clients").update({ nombre: n }).eq("user_id", user.id);
  }
  revalidatePath("/portal", "layout");
}

// El cliente aporta material (texto/link y/o archivo ya subido a storage) → queda como insumo
// del proyecto y avisa al equipo. Alimenta la generación de D0.
export async function addAporte(
  projectId: string,
  titulo: string,
  texto: string,
  fileUrl: string | null
) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No autorizado");
  const t = titulo.trim() || "Aporte del cliente";
  if (!texto.trim() && !fileUrl) throw new Error("Agrega un texto/link o un archivo");

  const supabase = await createClient();
  const { error } = await supabase.from("inputs").insert({
    project_id: projectId,
    tipo: "aporte_cliente",
    titulo: t,
    contenido_texto: texto.trim() || null,
    file_url: fileUrl,
    subido_por: user.id,
  });
  if (error) throw new Error(error.message);

  // Avisar al equipo (campanita + email).
  const admin = createAdminClient();
  await admin.from("notifications").insert([
    { target_rol: "admin", project_id: projectId, tipo: "aporte", texto: `${user.nombre} sumó material: ${t}` },
    { target_rol: "operador", project_id: projectId, tipo: "aporte", texto: `${user.nombre} sumó material: ${t}` },
  ]);
  const origin = await appOrigin();
  const shell = {
    titulo: `${user.nombre} sumó material`,
    cuerpo:
      `<p><strong>${t}</strong></p>` +
      (texto.trim() ? `<p style="color:#5a5147">${texto.trim().slice(0, 400)}</p>` : "") +
      (fileUrl ? `<p><a href="${fileUrl}">Ver archivo adjunto</a></p>` : ""),
    ctaUrl: `${origin}/projects/${projectId}`,
    ctaText: "Abrir el proyecto",
  };
  await notifyRole("admin", `Nuevo material de ${user.nombre}`, shell);
  await notifyRole("operador", `Nuevo material de ${user.nombre}`, shell);

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
}

// ── Comentarios de un entregable (ida y vuelta cliente ↔ equipo) ─────────────
export async function getComentarios(deliverableId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient(); // RLS filtra: staff todo, cliente solo lo suyo publicado
  const { data } = await supabase
    .from("comments")
    .select("id, texto, created_at, users(nombre, rol)")
    .eq("deliverable_id", deliverableId)
    .order("created_at");
  return data ?? [];
}

// El cliente (o el equipo) comenta el entregable. Avisa a la otra parte.
export async function comentar(deliverableId: string, texto: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No autorizado");
  const t = texto.trim();
  if (!t) throw new Error("Escribe un comentario");

  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .insert({ deliverable_id: deliverableId, user_id: user.id, texto: t });
  if (error) throw new Error(error.message);

  // contexto para el aviso
  const admin = createAdminClient();
  const { data: d } = await admin
    .from("deliverables")
    .select("tipo, titulo, project_id")
    .eq("id", deliverableId)
    .single();

  const origin = await appOrigin();
  if (user.rol === "cliente" && d) {
    // el cliente comentó → avisar al equipo (campanita + email)
    const resumen = `${user.nombre} comentó ${d.tipo} — ${d.titulo}`;
    await admin.from("notifications").insert([
      { target_rol: "admin", project_id: d.project_id, deliverable_id: deliverableId, tipo: "comentario", texto: resumen },
      { target_rol: "operador", project_id: d.project_id, deliverable_id: deliverableId, tipo: "comentario", texto: resumen },
    ]);
    const shell = {
      titulo: resumen,
      cuerpo: `<p style="border-left:3px solid #bc5b34;padding-left:12px;color:#1a1712">${t}</p>`,
      ctaUrl: `${origin}/projects/${d.project_id}`,
      ctaText: "Abrir el entregable",
    };
    await notifyRole("admin", resumen, shell);
    await notifyRole("operador", resumen, shell);
  } else if (d) {
    // el equipo comentó → avisar al cliente por correo
    const { data: proj } = await admin
      .from("projects")
      .select("clients(nombre, email, user_id)")
      .eq("id", d.project_id)
      .single();
    const cli = (proj as unknown as { clients: { nombre: string; email: string | null; user_id: string | null } | null })?.clients;
    if (cli?.email && cli.user_id) {
      await notifyEmail(cli.email, `Comentario en ${d.titulo}`, {
        titulo: `${cli.nombre.split(" ")[0]}, tienes un comentario`,
        cuerpo:
          `<p>Sobre <strong>${d.titulo}</strong>:</p>` +
          `<p style="border-left:3px solid #bc5b34;padding-left:12px;color:#1a1712">${t}</p>`,
        ctaUrl: `${origin}/portal/entregable/${deliverableId}`,
        ctaText: "Ver y responder",
      });
    }
  }

  revalidatePath(`/portal/entregable/${deliverableId}`);
  if (d) revalidatePath(`/projects/${d.project_id}`);
}

// El cliente envía un mensaje al equipo → queda con fecha/hora + avisa a admin y operador.
export async function enviarMensaje(projectId: string, texto: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("No autorizado");
  const t = texto.trim();
  if (!t) throw new Error("Escribe tu mensaje");

  const supabase = await createClient();
  const { data: proj } = await supabase.from("projects").select("client_id").eq("id", projectId).single();
  const { error } = await supabase.from("messages").insert({
    project_id: projectId,
    client_id: proj?.client_id ?? null,
    user_id: user.id,
    texto: t,
  });
  if (error) throw new Error(error.message);

  // Avisar al equipo (campanita + email). Los mensajes se leen en /inbox.
  const admin = createAdminClient();
  const resumen = `${user.nombre}: ${t.slice(0, 90)}${t.length > 90 ? "…" : ""}`;
  await admin.from("notifications").insert([
    { target_rol: "admin", project_id: projectId, tipo: "mensaje", texto: resumen },
    { target_rol: "operador", project_id: projectId, tipo: "mensaje", texto: resumen },
  ]);

  const origin = await appOrigin();
  const shell = {
    titulo: `Mensaje de ${user.nombre}`,
    cuerpo: `<p style="border-left:3px solid #bc5b34;padding-left:12px;color:#1a1712">${t}</p>`,
    ctaUrl: `${origin}/inbox`,
    ctaText: "Ver en el buzón",
  };
  await notifyRole("admin", `Nuevo mensaje de ${user.nombre}`, shell);
  await notifyRole("operador", `Nuevo mensaje de ${user.nombre}`, shell);

  revalidatePath("/inbox");
  revalidatePath("/portal");
}
