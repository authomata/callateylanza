"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, isStaff, isAdmin } from "@/lib/auth/roles";
import { extractVoiceFromMarkdown } from "@/lib/voice-extract";
import type { DeliverableTipo, GeneradoPor } from "@/lib/types";

const DELIVERABLE_NAMES: Record<DeliverableTipo, string> = {
  D0: "Extracción & Documento de Voz",
  D1: "Manual Maestro de Marca",
  D2: "Plan de Medios + Calendario 60d",
  D3: "Oferta & Framework",
  D4: "Masterclass / Lead Magnet",
  D5: "Landing Page",
  D6: "Banco Visual",
  D7: "System Prompt del Asistente",
  D8: "6 Videos Verticales",
};
const ALL_TIPOS = Object.keys(DELIVERABLE_NAMES) as DeliverableTipo[];

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

async function log(projectId: string, userId: string | null, accion: string, detalle?: string) {
  const supabase = await createClient();
  await supabase.from("activity_log").insert({ project_id: projectId, user_id: userId, accion, detalle });
}

export async function createProject(formData: FormData) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();

  const nombre = String(formData.get("cliente_nombre") || "").trim();
  if (!nombre) throw new Error("Falta el nombre del cliente");
  const proyecto = String(formData.get("proyecto_nombre") || "").trim() || `Kit ${nombre}`;

  const slug = `${slugify(nombre)}-${Math.random().toString(36).slice(2, 6)}`;
  const { data: client, error: cErr } = await supabase
    .from("clients")
    .insert({
      nombre,
      slug,
      email: String(formData.get("cliente_email") || "") || null,
      ciudad: String(formData.get("cliente_ciudad") || "") || null,
      rubro: String(formData.get("cliente_rubro") || "") || null,
    })
    .select("id")
    .single();
  if (cErr) throw new Error(cErr.message);

  const { data: project, error: pErr } = await supabase
    .from("projects")
    .insert({ client_id: client.id, nombre: proyecto, estado: "onboarding" })
    .select("id")
    .single();
  if (pErr) throw new Error(pErr.message);

  await supabase.from("voice_docs").insert({ project_id: project.id });
  await supabase.from("deliverables").insert(
    ALL_TIPOS.map((tipo, i) => ({
      project_id: project.id,
      tipo,
      titulo: DELIVERABLE_NAMES[tipo],
      orden: i,
      gate_bloqueado: tipo !== "D0" && tipo !== "D1", // D2-D8 locked until D1 aprobado
    }))
  );
  await log(project.id, user!.id, "proyecto_creado", `${nombre} — ${proyecto}`);

  redirect(`/projects/${project.id}`);
}

export async function addInput(formData: FormData) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();

  const projectId = String(formData.get("project_id"));
  const tipo = String(formData.get("tipo"));
  const titulo = String(formData.get("titulo") || "").trim() || "Sin título";
  const contenido = String(formData.get("contenido_texto") || "").trim() || null;

  const { error } = await supabase.from("inputs").insert({
    project_id: projectId,
    tipo,
    titulo,
    contenido_texto: contenido,
    subido_por: user!.id,
  });
  if (error) throw new Error(error.message);
  await log(projectId, user!.id, "insumo_agregado", `${tipo}: ${titulo}`);
  revalidatePath(`/projects/${projectId}`);
}

// Saves an edited deliverable as a new version (append-only history).
export async function saveDeliverableVersion(
  deliverableId: string,
  contenido: string,
  generado_por: GeneradoPor,
  instrucciones?: string | null,
  promptTemplateVersion?: number | null
) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("deliverables")
    .select("id, project_id, version_actual, estado")
    .eq("id", deliverableId)
    .single();
  if (!d) throw new Error("Entregable no encontrado");

  const nextVersion = (d.version_actual ?? 0) + 1;
  await supabase.from("deliverable_versions").insert({
    deliverable_id: deliverableId,
    version: nextVersion,
    contenido_md: contenido,
    generado_por,
    instrucciones: instrucciones ?? null,
    prompt_template_version: promptTemplateVersion ?? null,
    created_by: user!.id,
  });

  const nuevoEstado =
    generado_por === "ia" ? "borrador" : d.estado === "pendiente" ? "en_edicion" : d.estado === "borrador" ? "en_edicion" : d.estado;
  await supabase
    .from("deliverables")
    .update({ contenido_md: contenido, version_actual: nextVersion, estado: nuevoEstado })
    .eq("id", deliverableId);

  await log(d.project_id, user!.id, "version_guardada", `${deliverableId} v${nextVersion} (${generado_por})`);
  revalidatePath(`/projects/${d.project_id}`);
  return nextVersion;
}

// Lightweight autosave: persists edited content continuously so nothing is lost, WITHOUT
// snapshotting a version on every pause (versions are meaningful: generations + explicit saves).
export async function updateDeliverableContent(deliverableId: string, contenido: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("estado")
    .eq("id", deliverableId)
    .single();
  const estado =
    d?.estado === "borrador" || d?.estado === "pendiente" || d?.estado === "generando"
      ? "en_edicion"
      : d?.estado;
  const { error } = await supabase
    .from("deliverables")
    .update({ contenido_md: contenido, ...(estado ? { estado } : {}) })
    .eq("id", deliverableId);
  if (error) throw new Error(error.message);
}

// Publicar un entregable aprobado al portal del cliente (admin).
export async function publicar(deliverableId: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin puede publicar");
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("project_id, tipo, titulo, estado")
    .eq("id", deliverableId)
    .single();
  if (!d) throw new Error("Entregable no encontrado");
  if (d.estado !== "aprobado") throw new Error("El entregable debe estar aprobado para publicarse");

  const { error } = await supabase
    .from("deliverables")
    .update({ estado: "publicado", publicado_at: new Date().toISOString() })
    .eq("id", deliverableId);
  if (error) throw new Error(error.message);

  await supabase.from("notifications").insert({
    target_rol: "operador",
    project_id: d.project_id,
    deliverable_id: deliverableId,
    tipo: "publicado",
    texto: `${d.tipo} — ${d.titulo} se publicó al portal del cliente.`,
  });
  await log(d.project_id, user!.id, "publicado", d.tipo);
  revalidatePath(`/projects/${d.project_id}`);
}

// Invitar al cliente a su portal: crea/liga su cuenta con rol 'cliente' y devuelve un magic link.
export async function invitarCliente(projectId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin puede invitar");
  const supabase = await createClient();
  const { data: proj } = await supabase
    .from("projects")
    .select("client_id, clients(id, email, nombre, user_id)")
    .eq("id", projectId)
    .single();
  const client = (proj as unknown as { clients: { id: string; email: string | null; nombre: string; user_id: string | null } | null })?.clients;
  if (!client) throw new Error("Proyecto sin cliente");
  if (!client.email) throw new Error("El cliente no tiene email. Edítalo antes de invitar.");

  const admin = createAdminClient();

  // 1) asegurar el auth user
  let userId = client.user_id;
  if (!userId) {
    const created = await admin.auth.admin.createUser({
      email: client.email,
      email_confirm: true,
      user_metadata: { nombre: client.nombre },
    });
    if (created.error && !String(created.error.message).toLowerCase().includes("already")) {
      throw new Error(created.error.message);
    }
    userId = created.data?.user?.id ?? null;
    if (!userId) {
      const { data: existing } = await admin.from("users").select("id").eq("email", client.email).single();
      userId = existing?.id ?? null;
    }
  }
  if (!userId) throw new Error("No se pudo crear la cuenta del cliente");

  // 2) rol cliente + ligar al client
  await admin.from("users").update({ rol: "cliente", nombre: client.nombre }).eq("id", userId);
  await admin.from("clients").update({ user_id: userId }).eq("id", client.id);

  // 3) magic link de acceso al portal
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: client.email,
    options: { redirectTo: `${origin}/auth/callback?next=/portal` },
  });
  if (linkErr) throw new Error(linkErr.message);

  await log(projectId, user!.id, "cliente_invitado", client.email);
  revalidatePath(`/projects/${projectId}`);
  return link.properties.action_link;
}

// ── Assets (galerías D6/D8) ──────────────────────────────────────────────────
export async function addAsset(
  projectId: string,
  deliverableId: string | null,
  tipo: "foto" | "video" | "pdf" | "otro",
  categoria: string | null,
  fileUrl: string
) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { error } = await supabase.from("assets").insert({
    project_id: projectId,
    deliverable_id: deliverableId,
    tipo,
    categoria,
    file_url: fileUrl,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
}

export async function getAssets(deliverableId: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("assets")
    .select("id, tipo, categoria, file_url, aprobado, publicado")
    .eq("deliverable_id", deliverableId)
    .order("created_at");
  return data ?? [];
}

export async function setAssetFlags(assetId: string, patch: { aprobado?: boolean; publicado?: boolean }) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { error } = await supabase.from("assets").update(patch).eq("id", assetId);
  if (error) throw new Error(error.message);
}

export async function deleteAsset(assetId: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  await supabase.from("assets").delete().eq("id", assetId);
}

// Admin override del gate de dependencias.
export async function overrideUnlock(deliverableId: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin puede desbloquear");
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("project_id, tipo")
    .eq("id", deliverableId)
    .single();
  const { error } = await supabase
    .from("deliverables")
    .update({ desbloqueo_manual: true })
    .eq("id", deliverableId);
  if (error) throw new Error(error.message);
  if (d) {
    await log(d.project_id, user!.id, "desbloqueo_manual", d.tipo);
    revalidatePath(`/projects/${d.project_id}`);
  }
}

export async function setDeliverableEstado(deliverableId: string, estado: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("project_id, tipo, titulo")
    .eq("id", deliverableId)
    .single();
  const { error } = await supabase.from("deliverables").update({ estado }).eq("id", deliverableId);
  if (error) throw new Error(error.message);
  if (d) {
    await log(d.project_id, user!.id, "estado_cambiado", `${d.tipo} → ${estado}`);
    // Al marcar listo, avisar al admin (campanita).
    if (estado === "listo_para_revision") {
      await supabase.from("notifications").insert({
        target_rol: "admin",
        project_id: d.project_id,
        deliverable_id: deliverableId,
        tipo: "listo_para_revision",
        texto: `${user!.nombre} marcó ${d.tipo} — ${d.titulo} listo para revisión.`,
      });
    }
    revalidatePath(`/projects/${d.project_id}`);
  }
}

// Rechazo con feedback (admin): vuelve a edición + comentario + aviso al operador.
export async function rechazar(deliverableId: string, comentario: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin puede rechazar");
  if (!comentario.trim()) throw new Error("El rechazo requiere un comentario");
  const supabase = await createClient();
  const { data: d } = await supabase
    .from("deliverables")
    .select("project_id, tipo, titulo, estado")
    .eq("id", deliverableId)
    .single();
  if (!d) throw new Error("Entregable no encontrado");

  await supabase.from("deliverables").update({ estado: "rechazado" }).eq("id", deliverableId);
  await supabase.from("comments").insert({
    deliverable_id: deliverableId,
    user_id: user!.id,
    texto: comentario.trim(),
  });
  await supabase.from("notifications").insert({
    target_rol: "operador",
    project_id: d.project_id,
    deliverable_id: deliverableId,
    tipo: "rechazado",
    texto: `Andrés devolvió ${d.tipo} — ${d.titulo} con cambios. Revisa el comentario.`,
  });
  await log(d.project_id, user!.id, "rechazado", d.tipo);
  revalidatePath(`/projects/${d.project_id}`);
}

export async function addComment(deliverableId: string, texto: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  if (!texto.trim()) return;
  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .insert({ deliverable_id: deliverableId, user_id: user!.id, texto: texto.trim() });
  if (error) throw new Error(error.message);
}

export async function getComments(deliverableId: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("comments")
    .select("id, texto, created_at, users(nombre)")
    .eq("deliverable_id", deliverableId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// Notificaciones (campanita).
export async function markNotificationsRead() {
  const user = await getCurrentUser();
  if (!isStaff(user)) return;
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ leido: true })
    .eq("leido", false)
    .or(`target_rol.eq.${user!.rol},user_id.eq.${user!.id}`);
  revalidatePath("/", "layout");
}

export async function getVersions(deliverableId: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { data } = await supabase
    .from("deliverable_versions")
    .select("id, version, generado_por, instrucciones, contenido_md, created_at")
    .eq("deliverable_id", deliverableId)
    .order("version", { ascending: false });
  return data ?? [];
}

// Extrae el Documento de Voz desde el D0 generado y lo persiste en voice_docs.
export async function extractVoiceFromD0(projectId: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { data: d0 } = await supabase
    .from("deliverables")
    .select("contenido_md")
    .eq("project_id", projectId)
    .eq("tipo", "D0")
    .single();
  const voice = extractVoiceFromMarkdown(d0?.contenido_md);
  if (!voice) {
    throw new Error("El D0 aún no tiene el bloque de Documento de Voz. Genera D0 primero.");
  }
  const { error } = await supabase
    .from("voice_docs")
    .update({ ...voice, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  await log(projectId, user!.id, "voz_extraida_de_d0");
  revalidatePath(`/projects/${projectId}`);
}

export async function saveVoiceDoc(projectId: string, voice: {
  lexicon: unknown; citas_canon: unknown; registro_si_no: unknown; lineas_rojas: unknown;
}) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { error } = await supabase
    .from("voice_docs")
    .update({ ...voice, updated_at: new Date().toISOString() })
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  await log(projectId, user!.id, "voice_doc_guardado");
  revalidatePath(`/projects/${projectId}`);
}

export async function restoreVersion(deliverableId: string, versionId: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { data: v } = await supabase
    .from("deliverable_versions")
    .select("contenido_md")
    .eq("id", versionId)
    .single();
  if (!v) throw new Error("Versión no encontrada");
  return saveDeliverableVersion(deliverableId, v.contenido_md, "humano", "Restaurada desde una versión anterior");
}
