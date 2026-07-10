import { createHash } from "node:crypto";
import { marked } from "marked";

// SERVER-ONLY. Genera el HTML estático de la landing y lo deploya a Netlify.

const API = "https://api.netlify.com/api/v1";

async function nf(token: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Netlify ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

// Convierte el copy maestro (markdown de D5) en una página estática con la marca.
export function buildLandingHtml(md: string, opts: { titulo: string; brand?: string }): string {
  const body = marked.parse(md, { async: false, gfm: true }) as string;
  const brand = opts.brand ?? "#bc5b34";
  const title = opts.titulo.replace(/[<>&]/g, "");

  return `<!doctype html>
<html lang="es-CL">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,600;1,400&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root { --brand:${brand}; --bg:#efe9dc; --surface:#fbf8f1; --ink:#1a1712; --sec:#5a5147; --border:#e2daca; }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:"Instrument Sans",system-ui,sans-serif;font-size:17px;line-height:1.7}
  main{max-width:760px;margin:0 auto;padding:64px 24px 96px}
  h1{font-family:Newsreader,serif;font-weight:600;font-size:clamp(32px,5vw,48px);line-height:1.08;letter-spacing:-.5px;margin:0 0 .5em}
  h2{font-family:Newsreader,serif;font-weight:600;font-size:clamp(24px,3.4vw,32px);margin:2em 0 .4em}
  h3{font-family:Newsreader,serif;font-weight:400;font-size:22px;margin:1.4em 0 .3em}
  p,li{color:var(--sec)}
  strong{color:var(--ink)}
  ul,ol{padding-left:1.2em}
  blockquote{border-left:3px solid var(--brand);margin:1.4em 0;padding-left:1.1em;font-family:Newsreader,serif;font-style:italic;font-size:22px;color:var(--ink)}
  hr{border:none;border-top:1px solid var(--border);margin:2.4em 0}
  a{color:var(--brand)}
  table{border-collapse:collapse;width:100%;margin:1.2em 0}
  th,td{border:1px solid var(--border);padding:.5rem .7rem;text-align:left}
  th{background:var(--surface)}
  footer{border-top:1px solid var(--border);margin-top:64px;padding-top:20px;font-size:13px;color:#8c837a;text-align:center}
</style>
</head>
<body>
<main>
${body}
<footer>${title} · Hecho con Cállate y Lanza</footer>
</main>
</body>
</html>`;
}

export interface DeployResult {
  siteId: string;
  url: string;
}

// Crea el site si hace falta y sube un deploy de un solo archivo (index.html)
// usando el "file digest" de Netlify — sin necesidad de zip.
export async function deployLanding(args: {
  token: string;
  siteId: string | null;
  siteName: string;
  html: string;
}): Promise<DeployResult> {
  const { token, siteName, html } = args;
  let siteId = args.siteId;

  if (!siteId) {
    let created: Response;
    try {
      created = await nf(token, "/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: siteName }),
      });
    } catch {
      // el nombre puede estar tomado globalmente → deja que Netlify asigne uno
      created = await nf(token, "/sites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
    }
    const site = await created.json();
    siteId = site.id as string;
  }

  const sha = createHash("sha1").update(html).digest("hex");
  const deployRes = await nf(token, `/sites/${siteId}/deploys`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ files: { "/index.html": sha } }),
  });
  const deploy = await deployRes.json();

  if (Array.isArray(deploy.required) && deploy.required.includes(sha)) {
    await nf(token, `/deploys/${deploy.id}/files/index.html`, {
      method: "PUT",
      headers: { "content-type": "application/octet-stream" },
      body: html,
    });
  }

  const siteRes = await nf(token, `/sites/${siteId}`);
  const site = await siteRes.json();
  return { siteId: siteId!, url: (site.ssl_url || site.url) as string };
}
