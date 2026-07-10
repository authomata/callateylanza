import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { createClient } from "@/lib/supabase/server";
import { NotificationsBell } from "@/components/notifications-bell";
import type { Notification } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: notifs } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(15);
  const notifications = (notifs ?? []) as Notification[];
  const unread = notifications.filter((n) => !n.leido).length;

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-[58px] max-w-[1400px] items-center justify-between px-6">
          <div className="flex items-center gap-7">
            <Link href="/dashboard">
              <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-brand">
                Cállate y Lanza
              </span>
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/dashboard" className="text-secondary hover:text-foreground">
                Proyectos
              </Link>
              {user.rol === "admin" && (
                <Link href="/templates" className="text-secondary hover:text-foreground">
                  Plantillas
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <NotificationsBell initial={notifications} unread={unread} />
            <span className="text-secondary">{user.nombre}</span>
            <span className="rounded-full border border-[var(--border-card)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
              {user.rol}
            </span>
            <form action="/auth/signout" method="post">
              <button className="text-muted hover:text-foreground">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-7">{children}</main>
    </div>
  );
}
