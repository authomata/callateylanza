import sodium from "libsodium-wrappers";

// SERVER-ONLY. Crea y mantiene el repo del sitio de cada cliente en GitHub.
const API = "https://api.github.com";

async function gh(token: string, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

async function ghJson<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await gh(token, path, init);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status} ${path}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export interface RepoInfo {
  full_name: string;
  html_url: string;
  default_branch: string;
  owner: string;
  name: string;
}

// Crea el repo privado si no existe (auto_init deja un commit inicial + rama main).
export async function ensureRepo(
  token: string,
  owner: string,
  name: string,
  description: string
): Promise<RepoInfo> {
  const existing = await gh(token, `/repos/${owner}/${name}`);
  if (existing.ok) {
    const r = (await existing.json()) as { full_name: string; html_url: string; default_branch: string };
    return { full_name: r.full_name, html_url: r.html_url, default_branch: r.default_branch, owner, name };
  }
  // authomata es una cuenta de usuario → POST /user/repos
  const r = await ghJson<{ full_name: string; html_url: string; default_branch: string }>(
    token,
    `/user/repos`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, description, private: true, auto_init: true }),
    }
  );
  return { full_name: r.full_name, html_url: r.html_url, default_branch: r.default_branch, owner, name };
}

export interface RepoFile {
  path: string;
  content: string;
}

// Sube/actualiza varios archivos en UN commit (Git Data API). Crea o reemplaza indistintamente.
export async function pushFiles(
  token: string,
  owner: string,
  repo: string,
  branch: string,
  files: RepoFile[],
  message: string
): Promise<void> {
  const ref = await ghJson<{ object: { sha: string } }>(token, `/repos/${owner}/${repo}/git/ref/heads/${branch}`);
  const baseCommitSha = ref.object.sha;
  const baseCommit = await ghJson<{ tree: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/git/commits/${baseCommitSha}`
  );

  const tree = await Promise.all(
    files.map(async (f) => {
      const blob = await ghJson<{ sha: string }>(token, `/repos/${owner}/${repo}/git/blobs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: f.content, encoding: "utf-8" }),
      });
      return { path: f.path, mode: "100644", type: "blob", sha: blob.sha };
    })
  );

  const newTree = await ghJson<{ sha: string }>(token, `/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree }),
  });

  const commit = await ghJson<{ sha: string }>(token, `/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, tree: newTree.sha, parents: [baseCommitSha] }),
  });

  await ghJson(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sha: commit.sha }),
  });
}

// Guarda un secret de Actions (cifrado con el sealed box del repo).
export async function setActionsSecret(
  token: string,
  owner: string,
  repo: string,
  name: string,
  value: string
): Promise<void> {
  const pk = await ghJson<{ key: string; key_id: string }>(
    token,
    `/repos/${owner}/${repo}/actions/secrets/public-key`
  );
  await sodium.ready;
  const enc = sodium.crypto_box_seal(
    sodium.from_string(value),
    sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL)
  );
  const encrypted_value = sodium.to_base64(enc, sodium.base64_variants.ORIGINAL);
  const res = await gh(token, `/repos/${owner}/${repo}/actions/secrets/${name}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ encrypted_value, key_id: pk.key_id }),
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`GitHub secret ${name}: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}

// Lanza manualmente el workflow (workflow_dispatch) para forzar un deploy.
export async function dispatchWorkflow(
  token: string,
  owner: string,
  repo: string,
  workflow: string,
  branch: string
): Promise<void> {
  await gh(token, `/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref: branch }),
  });
}

// Comparte el repo con el cliente (colaborador). username = su usuario de GitHub.
export async function addCollaborator(
  token: string,
  owner: string,
  repo: string,
  username: string,
  permission: "push" | "maintain" | "admin" = "push"
): Promise<void> {
  const res = await gh(token, `/repos/${owner}/${repo}/collaborators/${username}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ permission }),
  });
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    throw new Error(`GitHub collaborator: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
}
