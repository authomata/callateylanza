"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser, isStaff } from "@/lib/auth/roles";
import { buildLandingHtml, deployLanding, createNetlifySite } from "@/lib/netlify";
import { extractLandingHtml } from "@/lib/landing-html";
import { getAnthropic, MODEL } from "@/lib/anthropic";
import { buildSitePrompt, presetByKey } from "@/lib/prompts/site-builder";
import { ensureRepo, pushFiles, setActionsSecret } from "@/lib/github";
import { buildWorkflow, buildReadme, buildClaudeMd } from "@/lib/repo-scaffold";
import type { VoiceDoc } from "@/lib/types";

// quita bloques ```html``` del copy (los de la v2) para no confundir al generador de sitio
function soloCopy(md: string): string {
  return md.replace(/```html\s*[\s\S]*?```/gi, "").trim();
}

// Staff, o el cliente dueño del proyecto.
async function requireProjectAccess(projectId: string): Promise<{ staff: boolean }> {
  const user = await getCurrentUser();
  if (!user) throw new Error("No autorizado");
  if (isStaff(user)) return { staff: true };

  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("id, clients(user_id)")
    .eq("id", projectId)
    .single();
  const ownerId = (data as unknown as { clients: { user_id: string | null } | null })?.clients?.user_id;
  if (!ownerId || ownerId !== user.id) throw new Error("No autorizado");
  return { staff: false };
}

async function loadLandingInputs(projectId: string) {
  const admin = createAdminClient();
  const { data: proj } = await admin
    .from("projects")
    .select("id, netlify_site_id, netlify_client_site_id, netlify_token, landing_owner, landing_html, clients(nombre, slug)")
    .eq("id", projectId)
    .single();
  if (!proj) throw new Error("Proyecto no encontrado");
  const client = (proj as unknown as { clients: { nombre: string; slug: string } }).clients;

  const { data: d5 } = await admin
    .from("deliverables")
    .select("contenido_md, estado")
    .eq("project_id", projectId)
    .eq("tipo", "D5")
    .single();
  if (!d5?.contenido_md?.trim()) {
    throw new Error("La landing (D5) aún no tiene contenido. Genérala primero.");
  }

  // Prioridad: el sitio generado (v3, projects.landing_html). Si no existe, cae al bloque html
  // de D5 (v2), y como último recurso renderiza el copy.
  const stored = (proj.landing_html as string | null)?.trim() || null;
  const html = stored ?? extractLandingHtml(d5.contenido_md) ?? buildLandingHtml(d5.contenido_md, { titulo: client.nombre });

  return { admin, proj, client, d5, html, esSitio: !!stored };
}

// Genera el SITIO (v3) con Opus a partir del copy aprobado + dirección de arte + preset.
export async function generarSitio(
  projectId: string,
  presetKey: string,
  instrucciones?: string
): Promise<{ ok: true }> {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");

  const admin = createAdminClient();
  const { data: proj } = await admin
    .from("projects")
    .select("id, clients(nombre, rubro)")
    .eq("id", projectId)
    .single();
  const client = (proj as unknown as { clients: { nombre: string; rubro: string | null } }).clients;

  const { data: delivs } = await admin
    .from("deliverables")
    .select("tipo, contenido_md")
    .eq("project_id", projectId)
    .in("tipo", ["D1", "D5", "D6"]);
  const byTipo = new Map((delivs ?? []).map((d) => [d.tipo, d.contenido_md as string | null]));
  const copy = byTipo.get("D5");
  if (!copy?.trim()) throw new Error("Genera primero el copy de D5.");

  const { system, user: um } = buildSitePrompt({
    clientName: client.nombre,
    rubro: client.rubro,
    copy: soloCopy(copy),
    tonoD1: byTipo.get("D1")?.slice(0, 3500) ?? null,
    paletaD6: byTipo.get("D6")?.slice(0, 1600) ?? null,
    preset: presetByKey(presetKey),
    instrucciones,
  });

  const stream = getAnthropic().messages.stream({
    model: MODEL,
    max_tokens: 24000,
    system,
    messages: [{ role: "user", content: um }],
  });
  const msg = await stream.finalMessage();
  const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const html = extractLandingHtml(text) ?? text.trim();
  if (!/<html[\s>]/i.test(html)) throw new Error("El modelo no devolvió un sitio válido. Reintenta.");

  await admin
    .from("projects")
    .update({ landing_html: html, landing_preset: presetKey })
    .eq("id", projectId);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

// Publica el sitio como repo de GitHub + GitHub Action que deploya a Netlify.
// Fuente de verdad editable (Claude Code/Codex) y entregable al cliente.
export async function publicarSitioRepo(projectId: string): Promise<{ repoUrl: string; url: string }> {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("No autorizado");

  const githubToken = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER || "authomata";
  const netlifyToken = process.env.NETLIFY_AUTH_TOKEN;
  if (!githubToken) throw new Error("Falta GITHUB_TOKEN en el servidor.");
  if (!netlifyToken) throw new Error("Falta NETLIFY_AUTH_TOKEN en el servidor.");

  const admin = createAdminClient();
  const { data: proj } = await admin
    .from("projects")
    .select("id, netlify_site_id, repo_name, landing_html, clients(nombre, rubro, slug)")
    .eq("id", projectId)
    .single();
  if (!proj) throw new Error("Proyecto no encontrado");
  const client = (proj as unknown as { clients: { nombre: string; rubro: string | null; slug: string } }).clients;
  const html = (proj.landing_html as string | null)?.trim();
  if (!html) throw new Error("Genera el sitio primero (botón «Generar sitio»).");

  // contexto de marca para el CLAUDE.md
  const { data: delivs } = await admin
    .from("deliverables")
    .select("tipo, contenido_md")
    .eq("project_id", projectId)
    .in("tipo", ["D1", "D6"]);
  const byTipo = new Map((delivs ?? []).map((d) => [d.tipo, d.contenido_md as string | null]));
  const { data: voice } = await admin
    .from("voice_docs")
    .select("*")
    .eq("project_id", projectId)
    .single<VoiceDoc>();

  const repoName = (proj.repo_name as string) || `callateylanza-${client.slug}`;

  // 1) sitio Netlify (vacío; lo deploya la Action)
  const site = await createNetlifySite({
    token: netlifyToken,
    siteId: (proj.netlify_site_id as string) ?? null,
    siteName: repoName,
  });

  // 2) repo privado
  const repo = await ensureRepo(githubToken, owner, repoName, `Landing de ${client.nombre} — Cállate y Lanza`);

  // 3) secrets de la Action (antes del push, para que el primer run los tenga)
  await setActionsSecret(githubToken, owner, repoName, "NETLIFY_AUTH_TOKEN", netlifyToken);
  await setActionsSecret(githubToken, owner, repoName, "NETLIFY_SITE_ID", site.siteId);

  // 4) archivos del repo (push en un commit → dispara el deploy)
  await pushFiles(githubToken, owner, repoName, repo.default_branch, [
    { path: "index.html", content: html },
    { path: "README.md", content: buildReadme(client.nombre, site.url) },
    {
      path: "CLAUDE.md",
      content: buildClaudeMd({
        clientName: client.nombre,
        rubro: client.rubro,
        paleta: byTipo.get("D6")?.slice(0, 1500) ?? null,
        arquetipo: byTipo.get("D1")?.slice(0, 2500) ?? null,
        voice: voice ?? null,
      }),
    },
    { path: ".github/workflows/deploy.yml", content: buildWorkflow() },
  ], "Actualiza el sitio");

  await admin
    .from("projects")
    .update({
      repo_url: repo.html_url,
      repo_name: repoName,
      netlify_site_id: site.siteId,
      landing_url: site.url,
      landing_owner: "andres",
    })
    .eq("id", projectId);

  await admin.from("activity_log").insert({
    project_id: projectId,
    user_id: user!.id,
    accion: "sitio_publicado_repo",
    detalle: repo.full_name,
  });
  revalidatePath(`/projects/${projectId}`);
  return { repoUrl: repo.html_url, url: site.url };
}

// HTML del sitio para previsualizar (staff u owner).
export async function getLandingHtml(projectId: string): Promise<string | null> {
  await requireProjectAccess(projectId);
  const admin = createAdminClient();
  const { data } = await admin.from("projects").select("landing_html").eq("id", projectId).single();
  return (data?.landing_html as string) ?? null;
}

// Estado seguro para la UI. NUNCA devuelve el token.
export async function getLandingStatus(projectId: string) {
  await requireProjectAccess(projectId);
  const admin = createAdminClient();
  const [{ data }, { data: d5 }] = await Promise.all([
    admin
      .from("projects")
      .select("landing_url, landing_owner, netlify_token, netlify_site_id, netlify_client_site_id, landing_html, landing_preset, repo_url")
      .eq("id", projectId)
      .single(),
    admin
      .from("deliverables")
      .select("contenido_md")
      .eq("project_id", projectId)
      .eq("tipo", "D5")
      .maybeSingle(),
  ]);

  return {
    landingUrl: (data?.landing_url as string) ?? null,
    owner: (data?.landing_owner as string) ?? null,
    hasClientToken: !!data?.netlify_token,
    hasStagingSite: !!data?.netlify_site_id,
    hasClientSite: !!data?.netlify_client_site_id,
    // sitio generado (v3)
    hasSite: !!(data?.landing_html as string | null)?.trim(),
    preset: (data?.landing_preset as string) ?? null,
    repoUrl: (data?.repo_url as string) ?? null,
    // ¿el D5 trae al menos copy para poder generar el sitio?
    hasCopy: !!d5?.contenido_md?.trim(),
  };
}

// PASO 1 — deploy inmediato a la cuenta Netlify de Andrés (entrega rápida).
export async function deployLandingAndres(projectId: string): Promise<string> {
  const user = await getCurrentUser();
  if (!isStaff(user)) throw new Error("Solo el equipo puede publicar en la cuenta de Andrés");

  const token = process.env.NETLIFY_AUTH_TOKEN;
  if (!token) throw new Error("Falta NETLIFY_AUTH_TOKEN en el servidor.");

  const { admin, proj, client, html } = await loadLandingInputs(projectId);
  const { siteId, url } = await deployLanding({
    token,
    siteId: (proj.netlify_site_id as string) ?? null,
    siteName: client.slug,
    html,
  });

  // Si la landing ya fue traspasada al cliente, no le robamos la URL oficial.
  const yaEsDelCliente = proj.landing_owner === "cliente";
  await admin
    .from("projects")
    .update({
      netlify_site_id: siteId,
      ...(yaEsDelCliente ? {} : { landing_url: url, landing_owner: "andres" }),
    })
    .eq("id", projectId);

  revalidatePath(`/projects/${projectId}`);
  return url;
}

// El cliente (o el equipo) guarda el token personal de Netlify del cliente. Se valida contra la API.
export async function saveClientNetlifyToken(projectId: string, token: string): Promise<void> {
  await requireProjectAccess(projectId);
  const t = token.trim();
  if (!t) throw new Error("Pega tu token de Netlify");

  const check = await fetch("https://api.netlify.com/api/v1/user", {
    headers: { Authorization: `Bearer ${t}` },
  });
  if (!check.ok) throw new Error("El token no es válido. Revísalo y vuelve a intentar.");

  const admin = createAdminClient();
  const { error } = await admin.from("projects").update({ netlify_token: t }).eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
}

// PASO 2 — traspaso: re-deploy del mismo sitio a la cuenta Netlify del cliente.
export async function deployLandingCliente(projectId: string): Promise<string> {
  await requireProjectAccess(projectId);
  const { admin, proj, client, html } = await loadLandingInputs(projectId);

  const token = proj.netlify_token as string | null;
  if (!token) throw new Error("El cliente aún no conectó su cuenta de Netlify.");

  const { siteId, url } = await deployLanding({
    token,
    siteId: (proj.netlify_client_site_id as string) ?? null,
    siteName: client.slug,
    html,
  });

  await admin
    .from("projects")
    .update({ netlify_client_site_id: siteId, landing_url: url, landing_owner: "cliente" })
    .eq("id", projectId);

  revalidatePath("/portal");
  revalidatePath(`/projects/${projectId}`);
  return url;
}
