import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";
import { ProfileForm } from "./profile-form";

export const dynamic = "force-dynamic";

export default async function PerfilPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <Link href="/portal" className="text-sm text-muted hover:underline">
          ← Mi Kit
        </Link>
        <h1 className="mt-1 font-serif text-[28px] leading-none">Tu perfil</h1>
        <p className="mt-1 text-sm text-muted">Actualiza tu nombre o cambia tu contraseña.</p>
      </div>
      <ProfileForm nombre={user.nombre} email={user.email} />
    </div>
  );
}
