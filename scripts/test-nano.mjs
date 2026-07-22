// Prueba real de nano-banana-pro-edit (MuAPI): sube foto ref, genera, poll, descarga.
//   node --env-file=.env.local scripts/test-nano.mjs
import { readFileSync, writeFileSync } from "node:fs";

const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MUAPI = process.env.MUAPI_API_KEY || "5e89e70e5e6e0cd120acea27a6dbd9feb4f0fb4e9cadc33441d58fde82fd2d1f";
const dir = "/private/tmp/claude-501/-Users-andreabustamante-callate-y-lanza-sw/68de8399-b044-42ba-bae1-53f36dd0b166/scratchpad";

// 1) subir la foto ref a Storage (bucket público 'assets')
const bytes = readFileSync(`${dir}/ref.jpg`);
const path = `test/ref-${bytes.length}.jpg`;
const up = await fetch(`${SUPA}/storage/v1/object/assets/${path}`, {
  method: "POST",
  headers: { apikey: SRK, authorization: `Bearer ${SRK}`, "content-type": "image/jpeg", "x-upsert": "true" },
  body: bytes,
});
if (!up.ok) throw new Error(`upload ${up.status}: ${await up.text()}`);
const refUrl = `${SUPA}/storage/v1/object/public/assets/${path}`;
console.log("ref subida:", refUrl);

// 2) submit a MuAPI
const prompt =
  "Editorial authority portrait of the same man for a personal brand website, seated confidently, warm cinematic studio lighting, deep terracotta and forest-green backdrop, wearing a refined dark blazer, shallow depth of field, magazine-quality. preserving his exact facial features, expression, skin tone and identity, do not alter features. natural skin texture, no beauty filter, no plastic smoothing.";
const submit = await fetch("https://api.muapi.ai/api/v1/nano-banana-pro-edit", {
  method: "POST",
  headers: { "x-api-key": MUAPI, "content-type": "application/json" },
  body: JSON.stringify({ prompt, images_list: [refUrl], aspect_ratio: "4:5", resolution: "2k" }),
});
const subText = await submit.text();
console.log("submit status:", submit.status, "\nbody:", subText.slice(0, 400));
if (!submit.ok) process.exit(1);
const sub = JSON.parse(subText);
const reqId = sub.request_id || sub.id || sub.requestId;
if (!reqId) { console.log("sin request_id — revisa el shape arriba"); process.exit(1); }
console.log("request_id:", reqId);

// 3) poll
const t0 = Date.now();
for (let i = 0; i < 60; i++) {
  await new Promise((r) => setTimeout(r, 3500));
  const res = await fetch(`https://api.muapi.ai/api/v1/predictions/${reqId}/result`, {
    headers: { "x-api-key": MUAPI },
  });
  const j = await res.json().catch(() => ({}));
  const status = j.status || j.state;
  process.stdout.write(`\r  poll ${i} · ${Math.round((Date.now() - t0) / 1000)}s · status=${status}   `);
  if (status === "completed" || status === "succeeded" || j.outputs || j.output) {
    const outputs = j.outputs || j.output || (j.result && (j.result.outputs || j.result.images)) || [];
    const list = Array.isArray(outputs) ? outputs : [outputs];
    console.log("\nRESULT:", JSON.stringify(j).slice(0, 500));
    const outUrl = typeof list[0] === "string" ? list[0] : list[0]?.url;
    if (outUrl) {
      const img = Buffer.from(await (await fetch(outUrl)).arrayBuffer());
      writeFileSync(`${dir}/nano-out.jpg`, img);
      console.log(`\n✓ imagen generada (${img.length} bytes) → ${dir}/nano-out.jpg\nurl: ${outUrl}`);
    }
    process.exit(0);
  }
  if (status === "failed" || status === "error") {
    console.log("\nFALLÓ:", JSON.stringify(j).slice(0, 400));
    process.exit(1);
  }
}
console.log("\ntimeout");
