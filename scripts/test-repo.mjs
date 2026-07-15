// Prueba end-to-end del sitio-como-repo: crea repo + secrets + push + sitio Netlify.
//   node --env-file=.env.local --experimental-strip-types scripts/test-repo.mjs
import { readFileSync } from "node:fs";
import { ensureRepo, pushFiles, setActionsSecret } from "../lib/github.ts";
import { createNetlifySite } from "../lib/netlify.ts";
import { buildWorkflow, buildReadme, buildClaudeMd } from "../lib/repo-scaffold.ts";

const gh = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER || "authomata";
const nf = process.env.NETLIFY_AUTH_TOKEN;
const repoName = "callateylanza-gabriel-g2";
const html = readFileSync(
  "/private/tmp/claude-501/-Users-andreabustamante-callate-y-lanza-sw/68de8399-b044-42ba-bae1-53f36dd0b166/scratchpad/gabriel-site.html",
  "utf8"
);

console.log("1) sitio Netlify…");
const site = await createNetlifySite({ token: nf, siteId: null, siteName: repoName });
console.log("   site:", site.siteId, site.url);

console.log("2) repo…");
const repo = await ensureRepo(gh, owner, repoName, "Landing de Gabriel — Cállate y Lanza");
console.log("   repo:", repo.html_url, "| branch:", repo.default_branch);

console.log("3) secrets…");
await setActionsSecret(gh, owner, repoName, "NETLIFY_AUTH_TOKEN", nf);
await setActionsSecret(gh, owner, repoName, "NETLIFY_SITE_ID", site.siteId);
console.log("   ✓ NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID");

console.log("4) push archivos…");
await pushFiles(
  gh,
  owner,
  repoName,
  repo.default_branch,
  [
    { path: "index.html", content: html },
    { path: "README.md", content: buildReadme("Gabriel Gajardo", site.url) },
    { path: "CLAUDE.md", content: buildClaudeMd({ clientName: "Gabriel Gajardo", rubro: "Coach para speakers", paleta: null, arquetipo: null, voice: null }) },
    { path: ".github/workflows/deploy.yml", content: buildWorkflow() },
  ],
  "Sitio inicial"
);
console.log("   ✓ push hecho — la Action debería estar deployando");
console.log("\nrepo:", repo.html_url, "\nsitio (en ~1-2 min):", site.url);
