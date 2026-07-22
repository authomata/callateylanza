// SERVER-ONLY. Cliente de MuAPI (nano-banana-pro-edit): edición de imagen con foto de referencia.
const BASE = "https://api.muapi.ai/api/v1";

export interface EditArgs {
  refUrls: string[]; // URLs públicas de las fotos de referencia
  prompt: string;
  aspect: string; // 1:1, 3:4, 4:3, 9:16, 16:9, 4:5, 5:4, 2:3, 3:2, 21:9
  resolution: string; // 1k, 2k, 4k
}

// Envía el trabajo. Devuelve el request_id (la generación es asíncrona).
export async function submitEdit(a: EditArgs): Promise<string> {
  const key = process.env.MUAPI_API_KEY;
  if (!key) throw new Error("Falta MUAPI_API_KEY en el servidor.");
  const res = await fetch(`${BASE}/nano-banana-pro-edit`, {
    method: "POST",
    headers: { "x-api-key": key, "content-type": "application/json" },
    body: JSON.stringify({
      prompt: a.prompt,
      images_list: a.refUrls,
      aspect_ratio: a.aspect,
      resolution: a.resolution,
    }),
  });
  if (!res.ok) throw new Error(`MuAPI ${res.status}: ${(await res.text()).slice(0, 250)}`);
  const j = await res.json();
  const id = j.request_id || j.id;
  if (!id) throw new Error("MuAPI no devolvió request_id");
  return id as string;
}

// Consulta el resultado. status: processing | completed | failed. url cuando está lista.
export async function pollResult(requestId: string): Promise<{ status: string; url: string | null }> {
  const key = process.env.MUAPI_API_KEY;
  const res = await fetch(`${BASE}/predictions/${requestId}/result`, {
    headers: { "x-api-key": key ?? "" },
  });
  const j = await res.json().catch(() => ({}));
  const outputs = Array.isArray(j.outputs) ? j.outputs : [];
  const url = outputs.length ? (typeof outputs[0] === "string" ? outputs[0] : outputs[0]?.url) : null;
  return { status: (j.status as string) || "processing", url: url ?? null };
}
