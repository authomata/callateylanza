// Genera los archivos del repo del sitio del cliente.
import type { VoiceDoc } from "@/lib/types";

// GitHub Action: en cada push a main, deploya el sitio a Netlify.
export function buildWorkflow(): string {
  return `name: Deploy a Netlify
on:
  push:
    branches: [main]
  workflow_dispatch:
permissions:
  contents: read
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy a Netlify
        uses: nwtgck/actions-netlify@v3.0
        with:
          publish-dir: '.'
          production-deploy: true
        env:
          NETLIFY_AUTH_TOKEN: \${{ secrets.NETLIFY_AUTH_TOKEN }}
          NETLIFY_SITE_ID: \${{ secrets.NETLIFY_SITE_ID }}
`;
}

export function buildReadme(clientName: string, siteUrl: string | null): string {
  return `# Landing de ${clientName}

Este repositorio es tu sitio web. Cada vez que se hace \`push\` a la rama \`main\`,
se publica solo en Netlify (vía GitHub Actions).

- **Sitio:** ${siteUrl ?? "(se genera en el primer deploy)"}
- **Archivo principal:** \`index.html\` (sitio estático, Tailwind vía CDN)

## Editarlo con IA (Claude Code, Codex, etc.)
1. Clona el repo:
   \`\`\`bash
   git clone <url-de-este-repo>
   cd ${clientName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}
   \`\`\`
2. Ábrelo con **Claude Code** o **Codex**. El archivo \`CLAUDE.md\` ya tiene tu voz de
   marca (paleta, tono, palabras clave), así el asistente edita sin romper tu estilo.
3. Pídele cambios en \`index.html\` ("cambia el hero", "agrega una sección de testimonios").
4. \`git commit\` + \`git push\` → el sitio se actualiza solo en ~1 minuto.

## Hacerlo 100% tuyo (llevarlo a tu propia Netlify)
1. Crea una cuenta gratis en [netlify.com](https://app.netlify.com/signup).
2. Saca un token: *User settings → Applications → New access token*.
3. En este repo: *Settings → Secrets and variables → Actions* y reemplaza:
   - \`NETLIFY_AUTH_TOKEN\` por tu token.
   - \`NETLIFY_SITE_ID\` por el de tu sitio (o borra el secret y crea un sitio nuevo en tu Netlify apuntando a este repo).
4. Listo: el sitio queda en tu cuenta.

---
Hecho con Cállate y Lanza.
`;
}

export interface BrandContext {
  clientName: string;
  rubro: string | null;
  paleta: string | null; // extracto de D6
  arquetipo: string | null; // extracto de D1
  voice: VoiceDoc | null;
}

// CLAUDE.md: contexto de marca para que cualquier agente edite EN la voz del cliente.
export function buildClaudeMd(b: BrandContext): string {
  const lex = (b.voice?.lexicon ?? []).slice(0, 12).map((l) => `- **${l.expresion}** — ${l.significado}`).join("\n");
  const citas = (b.voice?.citas_canon ?? []).slice(0, 6).map((c) => `> ${c.cita}`).join("\n");
  const si = (b.voice?.registro_si_no?.si ?? []).map((s) => `- ${s}`).join("\n");
  const no = (b.voice?.registro_si_no?.no ?? []).map((s) => `- ${s}`).join("\n");
  const rojas = (b.voice?.lineas_rojas ?? []).map((s) => `- ${s}`).join("\n");

  return `# Guía de marca — ${b.clientName}

Este sitio es de **${b.clientName}**${b.rubro ? ` (${b.rubro})` : ""}. Cuando edites \`index.html\`,
respeta SIEMPRE esta guía. El objetivo es que el sitio suene y se vea como esta persona, no genérico.

## Reglas duras
- Español de Chile, **tuteo**. Nunca voseo argentino (tenés, podés, acá, mirá).
- Le hablas al visitante en segunda persona; la voz del cliente (cuando habla él) es primera persona.
- No inventes datos, testimonios ni cifras. Usa solo lo que ya está en el sitio.
- Mantén el sitio en un solo \`index.html\` autocontenido (Tailwind vía CDN). No agregues build.

## Paleta y estética
${b.paleta ?? "(usa la paleta ya definida en el <script> de tailwind.config del index.html)"}

## Arquetipo y tono
${b.arquetipo ?? "(ver el hero y la sección «sobre mí» del sitio)"}

## Cómo suena
**SÍ suena a él/ella:**
${si || "- (definir)"}

**NUNCA suena a él/ella:**
${no || "- (definir)"}

## Lexicón (sus palabras)
${lex || "- (sin lexicón cargado)"}

## Frases canon (textuales, se pueden citar)
${citas || "> (sin citas)"}

## Líneas rojas
${rojas || "- (sin líneas rojas)"}
`;
}
