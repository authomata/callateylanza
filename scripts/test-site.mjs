// Prueba el generador de sitio v3 con el copy real de un proyecto.
//   node --env-file=.env.local --experimental-strip-types scripts/test-site.mjs [preset]
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { buildSitePrompt, presetByKey } from "../lib/prompts/site-builder.ts";
import { extractLandingHtml } from "../lib/landing-html.ts";

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-4-8";
const preset = presetByKey(process.argv[2] || "coach");

// Gabriel G2
const { data: proj } = await admin
  .from("projects")
  .select("id, clients(nombre, rubro)")
  .eq("id", "e9bcecaa-206d-4e8a-a0c2-64797c555e80")
  .single();
const client = proj.clients;

const { data: delivs } = await admin
  .from("deliverables")
  .select("tipo, contenido_md")
  .eq("project_id", proj.id)
  .in("tipo", ["D1", "D5", "D6"]);
const by = new Map(delivs.map((d) => [d.tipo, d.contenido_md]));
const copy = (by.get("D5") || "").replace(/```html\s*[\s\S]*?```/gi, "").trim();
console.log(`cliente: ${client.nombre} | preset: ${preset.nombre} | copy: ${copy.length} chars | D6: ${by.get("D6") ? "sí" : "no"}`);

const { system, user } = buildSitePrompt({
  clientName: client.nombre,
  rubro: client.rubro,
  copy,
  tonoD1: (by.get("D1") || "").slice(0, 3500) || null,
  paletaD6: (by.get("D6") || "").slice(0, 1600) || null,
  preset,
});

console.log("generando con Opus…");
const t0 = Date.now();
const msg = await anthropic.messages.stream({ model: MODEL, max_tokens: 24000, system, messages: [{ role: "user", content: user }] }).finalMessage();
const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
const html = extractLandingHtml(text) || text.trim();

const out = "/private/tmp/claude-501/-Users-andreabustamante-callate-y-lanza-sw/68de8399-b044-42ba-bae1-53f36dd0b166/scratchpad/gabriel-site.html";
writeFileSync(out, html);
console.log(`\n✓ ${Math.round((Date.now() - t0) / 1000)}s · ${html.length} chars · out=${out}`);
console.log("tokens:", msg.usage.input_tokens, "in /", msg.usage.output_tokens, "out");
const checks = {
  doctype: /^<!doctype html/i.test(html),
  tailwind: html.includes("cdn.tailwindcss.com"),
  tailwindConfig: html.includes("tailwind.config"),
  googleFonts: html.includes("fonts.googleapis.com"),
  gradient: /gradient|radial-gradient|conic/i.test(html),
  ogTags: html.includes('property="og:'),
  hero: /min-h-screen|h-screen/i.test(html),
  faqScript: /IntersectionObserver|accordion|acorde/i.test(html),
  noLorem: !/lorem ipsum/i.test(html),
};
console.log("checks:", checks);
