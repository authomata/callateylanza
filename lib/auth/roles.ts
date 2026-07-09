import { createClient } from "@/lib/supabase/server";
import type { AppUser } from "@/lib/types";

// Returns the authenticated app user (with role) or null.
export async function getCurrentUser(): Promise<AppUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("users")
    .select("id, nombre, email, rol, activo")
    .eq("id", user.id)
    .single();

  return (data as AppUser) ?? null;
}

export function isStaff(u: AppUser | null): boolean {
  return !!u && (u.rol === "admin" || u.rol === "operador") && u.activo;
}

export function isAdmin(u: AppUser | null): boolean {
  return !!u && u.rol === "admin" && u.activo;
}

// For route handlers: returns the user or throws a Response to short-circuit.
export async function requireStaff(): Promise<AppUser> {
  const u = await getCurrentUser();
  if (!isStaff(u)) throw jsonError(401, "No autorizado");
  return u!;
}

export async function requireAdmin(): Promise<AppUser> {
  const u = await getCurrentUser();
  if (!isAdmin(u)) throw jsonError(403, "Solo un admin puede realizar esta acción");
  return u!;
}

export function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "content-type": "application/json" },
  });
}
