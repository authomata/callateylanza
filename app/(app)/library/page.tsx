import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isAdmin } from "@/lib/auth/roles";
import type { LibraryItem } from "@/lib/types";
import { LibraryAdmin } from "./library-admin";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const user = await getCurrentUser();
  if (!isAdmin(user)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("library_items")
    .select("*")
    .order("seccion")
    .order("orden");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[32px] leading-none">Biblioteca</h1>
        <p className="mt-1 text-sm text-muted">
          Videos de onboarding y cursos, comunes a todos los clientes. Se muestran en su portal.
        </p>
      </div>
      <LibraryAdmin items={(data ?? []) as LibraryItem[]} />
    </div>
  );
}
