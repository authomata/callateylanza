// Backfill: extrae el Documento de Voz de cada D0 ya generado y lo persiste en voice_docs.
//   node --env-file=.env.local --experimental-strip-types scripts/backfill-voice.mjs
import { createClient } from "@supabase/supabase-js";
import { extractVoiceFromMarkdown } from "../lib/voice-extract.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, { auth: { persistSession: false } });

const { data: d0s } = await admin
  .from("deliverables")
  .select("project_id, contenido_md")
  .eq("tipo", "D0");

for (const d of d0s ?? []) {
  const tag = d.project_id.slice(0, 8);
  const voice = extractVoiceFromMarkdown(d.contenido_md);
  if (!voice) {
    console.log(tag, "— sin bloque de voz en D0, se omite");
    continue;
  }
  const { error } = await admin
    .from("voice_docs")
    .update({ ...voice, updated_at: new Date().toISOString() })
    .eq("project_id", d.project_id);
  console.log(
    tag,
    error ? `ERROR: ${error.message}` : `✓ ${voice.lexicon.length} lexicón · ${voice.citas_canon.length} citas · ${voice.lineas_rojas.length} líneas rojas`
  );
}
console.log("backfill listo");
