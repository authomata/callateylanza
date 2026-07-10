import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff } from "@/lib/auth/roles";
import { InboxThreads, type RawMessage } from "./inbox-list";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!isStaff(user)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, texto, resuelto, de_equipo, created_at, project_id, projects(id, nombre, clients(nombre, email)), users(nombre)")
    .order("created_at", { ascending: true });

  const messages = (data ?? []) as unknown as RawMessage[];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[32px] leading-none">Buzón</h1>
        <p className="mt-1 text-sm text-muted">
          Conversaciones con los clientes. Todo queda en el hilo, con fecha y hora.
        </p>
      </div>
      <InboxThreads messages={messages} />
    </div>
  );
}
