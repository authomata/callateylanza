import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

// SERVER-ONLY. Envío de notificaciones por email vía Resend (API REST, sin dependencias).
// Los envíos NUNCA rompen la acción que los dispara: si fallan, se loguea y se sigue.

const FROM = process.env.EMAIL_FROM || "Cállate y Lanza <andres@authomata.ai>";

// Origen absoluto de la app (para armar links en los correos).
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${h.get("host")}`;
}

export interface ShellOpts {
  titulo: string;
  cuerpo: string; // HTML simple (párrafos)
  ctaUrl?: string;
  ctaText?: string;
  pie?: string;
}

// Plantilla de marca (El Atelier), con estilos inline para clientes de correo.
export function emailShell({ titulo, cuerpo, ctaUrl, ctaText, pie }: ShellOpts): string {
  const cta =
    ctaUrl && ctaText
      ? `<tr><td style="padding:26px 0 6px">
           <a href="${ctaUrl}" style="background:#bc5b34;color:#fbf8f1;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${ctaText}</a>
         </td></tr>`
      : "";

  return `<!doctype html><html lang="es"><body style="margin:0;background:#efe9dc;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#efe9dc;padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fbf8f1;border:1px solid #e7dfce;border-radius:12px;padding:32px">
        <tr><td style="font-size:11px;letter-spacing:2.4px;text-transform:uppercase;color:#bc5b34;font-weight:600;padding-bottom:14px">Cállate y Lanza</td></tr>
        <tr><td style="font-size:24px;line-height:1.25;color:#1a1712;font-weight:600;padding-bottom:12px">${titulo}</td></tr>
        <tr><td style="font-size:15px;line-height:1.65;color:#5a5147">${cuerpo}</td></tr>
        ${cta}
        <tr><td style="border-top:1px solid #e2daca;margin-top:24px;padding-top:18px;font-size:12px;color:#8c837a">
          ${pie ?? "Andrés Bustamante · andres@authomata.ai"}
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

// Envía un correo. Devuelve true si Resend lo aceptó.
export async function sendEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[email] RESEND_API_KEY ausente — no se envía nada.");
    return false;
  }
  const to = (Array.isArray(args.to) ? args.to : [args.to]).filter(Boolean);
  if (to.length === 0) return false;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ from: FROM, to, subject: args.subject, html: args.html }),
    });
    if (!res.ok) {
      console.error("[email] Resend", res.status, (await res.text()).slice(0, 300));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] fallo de red", e);
    return false;
  }
}

// Emails de todos los usuarios activos de un rol.
export async function emailsForRol(rol: "admin" | "operador"): Promise<string[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin.from("users").select("email").eq("rol", rol).eq("activo", true);
    return (data ?? []).map((u) => u.email as string).filter(Boolean);
  } catch {
    return [];
  }
}

// Notifica a todo un rol (admin u operador). Nunca lanza.
export async function notifyRole(
  rol: "admin" | "operador",
  subject: string,
  shell: ShellOpts
): Promise<void> {
  try {
    const to = await emailsForRol(rol);
    if (to.length === 0) return;
    await sendEmail({ to, subject, html: emailShell(shell) });
  } catch (e) {
    console.error("[email] notifyRole", e);
  }
}

// Notifica a una dirección puntual (el cliente). Nunca lanza.
export async function notifyEmail(
  to: string | null | undefined,
  subject: string,
  shell: ShellOpts
): Promise<void> {
  if (!to) return;
  try {
    await sendEmail({ to, subject, html: emailShell(shell) });
  } catch (e) {
    console.error("[email] notifyEmail", e);
  }
}
