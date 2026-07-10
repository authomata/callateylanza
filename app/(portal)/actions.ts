"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth/roles";

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
