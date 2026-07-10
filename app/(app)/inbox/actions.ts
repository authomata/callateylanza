"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff } from "@/lib/auth/roles";

export async function marcarMensaje(id: string, resuelto: boolean) {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");
  const supabase = await createClient();
  const { error } = await supabase.from("messages").update({ resuelto }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/inbox");
}
