"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/roles";
import { notifyRole, appOrigin } from "@/lib/email";

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
