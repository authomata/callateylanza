"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/roles";

export async function saveLibraryItem(formData: FormData) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin");
  const supabase = await createClient();
  const row = {
    seccion: String(formData.get("seccion")),
    titulo: String(formData.get("titulo") || "").trim(),
    embed_url: String(formData.get("embed_url") || "").trim() || null,
    descripcion: String(formData.get("descripcion") || "").trim() || null,
    orden: Number(formData.get("orden") || 0),
    activo: true,
  };
  if (!row.titulo) throw new Error("Falta el título");
  const { error } = await supabase.from("library_items").insert(row);
  if (error) throw new Error(error.message);
  revalidatePath("/library");
}

export async function toggleLibraryActivo(id: string, activo: boolean) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin");
  const supabase = await createClient();
  await supabase.from("library_items").update({ activo }).eq("id", id);
  revalidatePath("/library");
}

export async function deleteLibraryItem(id: string) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin");
  const supabase = await createClient();
  await supabase.from("library_items").delete().eq("id", id);
  revalidatePath("/library");
}
