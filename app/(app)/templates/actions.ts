"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/roles";
import type { DeliverableTipo } from "@/lib/types";

interface TemplateFields {
  nombre: string;
  prompt_sistema: string;
  estructura_output: string;
  checklist_calidad: string[];
}

function parseForm(formData: FormData): TemplateFields {
  return {
    nombre: String(formData.get("nombre") || "").trim(),
    prompt_sistema: String(formData.get("prompt_sistema") || ""),
    estructura_output: String(formData.get("estructura_output") || ""),
    checklist_calidad: String(formData.get("checklist_calidad") || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  };
}

// Edit the current version in place (fast tuning — prompts as data, no deploy).
export async function updateTemplate(formData: FormData) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin");
  const id = String(formData.get("id"));
  const f = parseForm(formData);
  const supabase = await createClient();
  const { error } = await supabase
    .from("module_templates")
    .update({ ...f, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
}

// Snapshot a new version and activate it (keeps full history of prompt evolution).
export async function saveAsNewVersion(formData: FormData) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin");
  const tipo = String(formData.get("tipo")) as DeliverableTipo;
  const inputs_requeridos = JSON.parse(String(formData.get("inputs_requeridos") || "[]"));
  const f = parseForm(formData);
  const supabase = await createClient();

  const { data: rows } = await supabase.from("module_templates").select("version").eq("tipo", tipo);
  const nextVersion = Math.max(0, ...(rows ?? []).map((r) => r.version)) + 1;

  await supabase.from("module_templates").update({ activa: false }).eq("tipo", tipo);
  const { error } = await supabase.from("module_templates").insert({
    tipo,
    version: nextVersion,
    inputs_requeridos,
    ...f,
    activa: true,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
}

export async function activateVersion(id: string, tipo: DeliverableTipo) {
  const user = await getCurrentUser();
  if (!isAdmin(user)) throw new Error("Solo un admin");
  const supabase = await createClient();
  await supabase.from("module_templates").update({ activa: false }).eq("tipo", tipo);
  await supabase.from("module_templates").update({ activa: true }).eq("id", id);
  revalidatePath("/templates");
}
