import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-[58px] max-w-[1000px] items-center justify-between px-6">
          <span className="font-mono text-[13px] font-semibold uppercase tracking-[0.22em] text-brand">
            Cállate y Lanza
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-secondary">{user.nombre}</span>
            <form action="/auth/signout" method="post">
              <button className="text-muted hover:text-foreground">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1000px] flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
