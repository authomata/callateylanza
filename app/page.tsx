import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/roles";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect(user.rol === "cliente" ? "/portal" : "/dashboard");
}
