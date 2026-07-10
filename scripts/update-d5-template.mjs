// Sube la plantilla v2 de D5 (landing real en HTML) a module_templates y genera el SQL
// equivalente para instalaciones nuevas.
//   node --env-file=.env.local --experimental-strip-types scripts/update-d5-template.mjs
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { D5_V2 } from "../lib/prompts/d5-landing.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const admin = createClient(url, key, { auth: { persistSession: false } });

// solo una versión activa por tipo (índice parcial único): desactivar antes de activar la nueva
const { error: offErr } = await admin.from("module_templates").update({ activa: false }).eq("tipo", "D5");
if (offErr) throw new Error(offErr.message);

const row = {
  tipo: D5_V2.tipo,
  version: D5_V2.version,
  nombre: D5_V2.nombre,
  prompt_sistema: D5_V2.prompt_sistema,
  estructura_output: D5_V2.estructura_output,
  inputs_requeridos: D5_V2.inputs_requeridos,
  checklist_calidad: D5_V2.checklist_calidad,
  activa: true,
};
const { error } = await admin.from("module_templates").upsert(row, { onConflict: "tipo,version" });
if (error) throw new Error(error.message);
console.log(`✓ D5 v${D5_V2.version} activa — "${D5_V2.nombre}"`);

// SQL canónico para fresh installs (mismo contenido, una sola fuente de verdad)
const q = (s) => `$p5$${s}$p5$`;
const sql = `-- Fase 3-E fix — D5 v2: además del copy, emite la LANDING REAL en un bloque \`\`\`html\`\`\`.
-- Generado por scripts/update-d5-template.mjs desde lib/prompts/d5-landing.ts. Idempotente.

update module_templates set activa = false where tipo = 'D5';

insert into module_templates (tipo, version, nombre, prompt_sistema, estructura_output, inputs_requeridos, checklist_calidad, activa)
values ('D5', ${D5_V2.version}, ${q(D5_V2.nombre)}, ${q(D5_V2.prompt_sistema)}, ${q(D5_V2.estructura_output)},
  '${JSON.stringify(D5_V2.inputs_requeridos)}'::jsonb,
  ${q(JSON.stringify(D5_V2.checklist_calidad))}::jsonb,
  true)
on conflict (tipo, version) do update set
  nombre = excluded.nombre, prompt_sistema = excluded.prompt_sistema,
  estructura_output = excluded.estructura_output, inputs_requeridos = excluded.inputs_requeridos,
  checklist_calidad = excluded.checklist_calidad, activa = true, updated_at = now();
`;
writeFileSync("supabase/migrations/0007_d5_v2.sql", sql);
console.log("✓ supabase/migrations/0007_d5_v2.sql escrito");
