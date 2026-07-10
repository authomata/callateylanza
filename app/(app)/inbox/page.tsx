import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, isStaff } from "@/lib/auth/roles";
import { InboxList, type InboxMessage } from "./inbox-list";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await getCurrentUser();
  if (!isStaff(user)) redirect("/dashboard");

  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, texto, resuelto, created_at, clients(nombre, email), projects(id, nombre)")
    .order("created_at", { ascending: false });

  const messages = (data ?? []) as unknown as InboxMessage[];
  const pendientes = messages.filter((m) => !m.resuelto).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-serif text-[32px] leading-none">Buzón</h1>
        <p className="mt-1 text-sm text-muted">
          Mensajes de los clientes desde su portal. {pendientes > 0 ? `${pendientes} pendiente(s).` : "Todo al día."}
        </p>
      </div>
      <InboxList messages={messages} />
    </div>
  );
}
