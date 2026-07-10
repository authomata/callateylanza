"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, isStaff } from "@/lib/auth/roles";
import { notifyEmail, appOrigin } from "@/lib/email";

// El equipo responde dentro del hilo. Queda trazado y el cliente lo ve en su portal.
export async function responderMensaje(projectId: string, texto: string) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const t = texto.trim();
  if (!t) throw new Error("Escribe una respuesta");

  const supabase = await createClient();
  const { error } = await supabase.from("messages").insert({
    project_id: projectId,
    user_id: user!.id,
    texto: t,
    de_equipo: true,
    resuelto: false,
  });
  if (error) throw new Error(error.message);

  // Avisar al cliente por correo (el hilo vive en su portal).
  const admin = createAdminClient();
  const { data: proj } = await admin
    .from("projects")
    .select("clients(nombre, email, user_id)")
    .eq("id", projectId)
    .single();
  const cli = (proj as unknown as { clients: { nombre: string; email: string | null; user_id: string | null } | null })?.clients;
  if (cli?.email && cli.user_id) {
    const origin = await appOrigin();
    await notifyEmail(cli.email, "Andrés te respondió", {
      titulo: `${cli.nombre.split(" ")[0]}, tienes una respuesta`,
      cuerpo:
        `<p>Te respondimos en tu portal:</p>` +
        `<p style="border-left:3px solid #bc5b34;padding-left:12px;color:#1a1712">${t}</p>`,
      ctaUrl: `${origin}/portal`,
      ctaText: "Ver la conversación",
    });
  }

  revalidatePath("/inbox");
  revalidatePath("/portal");
}

// Marcar un hilo (todos los mensajes del cliente en ese proyecto) como resuelto / reabrir.
export async function marcarThreadResuelto(projectId: string, resuelto: boolean) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { error } = await supabase
    .from("messages")
    .update({ resuelto })
    .eq("project_id", projectId)
    .eq("de_equipo", false);
  if (error) throw new Error(error.message);
  revalidatePath("/inbox");
}
