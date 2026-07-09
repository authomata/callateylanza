import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-baseline gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-[var(--accent)]">
                Cállate y Lanza
              </span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/dashboard" className="text-muted hover:text-foreground">
                Proyectos
              </Link>
              {user.rol === "admin" && (
                <Link href="/templates" className="text-muted hover:text-foreground">
                  Plantillas
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-muted">
              {user.nombre} · <span className="uppercase text-xs">{user.rol}</span>
            </span>
            <form action="/auth/signout" method="post">
              <button className="text-muted underline underline-offset-2 hover:text-foreground">
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
