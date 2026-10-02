import { withSupabase } from "npm:@supabase/server@1";
import { SignJWT, importPKCS1, importPKCS8 } from "npm:jose@6.1.0";

const OWNER = "Lyte3075";
const REPO = "SingulaX";
const BRANCH = "community-projects";
const ROOT = "projects";
const EXTENSIONS = ["sglx","txt","vlla","cyln","smsc","wsc","ctrsc","ezsc","lyte3075"];
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_TOTAL_BYTES = 5 * 1024 * 1024;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "project";
}

function cleanPath(value: string) {
  const p = String(value).replace(/^\/+/, "").replace(/\\/g, "/");
  if (!p || p.startsWith(".") || p.includes("../") || p.includes("/..") || p.includes("\0")) {
    throw new Error("Invalid project file path.");
  }
  return p;
}

function ext(path: string) {
  const m = path.match(/\.([^.\/]+)$/);
  return m ? m[1].toLowerCase() : "";
}

function bytes(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

async function github(path: string, token: string, init: RequestInit = {}) {
  const r = await fetch("https://api.github.com" + path, {
    ...init,
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": "Bearer " + token,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!r.ok) throw new Error("GitHub API " + r.status + (data?.message ? ": " + data.message : ""));
  return data;
}

async function appToken() {
  const appId = Deno.env.get("GITHUB_APP_ID");
  const privateKey = Deno.env.get("GITHUB_APP_PRIVATE_KEY");
  if (!appId || !privateKey) throw new Error("GitHub App is not configured on the publisher.");

  const pem = privateKey.replace(/\\n/g, "\n").trim();
  const key = pem.includes("BEGIN RSA PRIVATE KEY")
    ? await importPKCS1(pem, "RS256")
    : await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 540)
    .setIssuer(appId)
    .sign(key);

  const installs = await github("/app/installations?per_page=100", jwt);
  const installation = (installs || []).find((x: any) =>
    x.account?.login?.toLowerCase() === OWNER.toLowerCase()
  );
  if (!installation) throw new Error("SingulaX Community Publisher is not installed on the Lyte3075 account.");

  const token = await github("/app/installations/" + installation.id + "/access_tokens", jwt, {
    method: "POST",
    body: JSON.stringify({ repositories: [REPO], permissions: { contents: "write", metadata: "read" } }),
  });
  return token.token as string;
}

async function readIndex(token: string) {
  const data = await github("/repos/" + OWNER + "/" + REPO + "/contents/" + ROOT + "/index.json?ref=" + encodeURIComponent(BRANCH), token);
  const decoded = atob(String(data.content || "").replace(/\n/g, ""));
  return JSON.parse(new TextDecoder().decode(Uint8Array.from(decoded, c => c.charCodeAt(0))));
}

async function blob(token: string, content: string) {
  return github("/repos/" + OWNER + "/" + REPO + "/git/blobs", token, {
    method: "POST",
    body: JSON.stringify({ content: btoa(unescape(encodeURIComponent(content))), encoding: "base64" }),
  });
}

async function publish(req: Request, ctx: any) {
  const body = await req.json();
  const name = String(body.name || "").trim();
  const description = String(body.description || "A SingulaX project").trim().slice(0, 500);
  const version = String(body.version || "1.0.0").trim().slice(0, 50);
  const filesInput = Array.isArray(body.files) ? body.files : [];

  if (!name || name.length > 100) throw new Error("Project name is required and must be 100 characters or fewer.");
  if (!filesInput.length || filesInput.length > 50) throw new Error("A project must contain 1 to 50 files.");

  const files: { path: string; content: string }[] = [];
  const seen = new Set<string>();
  let total = 0;

  for (const item of filesInput) {
    const path = cleanPath(item?.path || "");
    const content = String(item?.content ?? "");
    if (!EXTENSIONS.includes(ext(path))) throw new Error("Unsupported source extension: " + ext(path));
    if (seen.has(path)) throw new Error("Duplicate project file: " + path);
    if (bytes(content) > MAX_FILE_BYTES) throw new Error("File is too large: " + path);
    total += bytes(content);
    if (total > MAX_TOTAL_BYTES) throw new Error("Project is too large. The limit is 5 MB.");
    seen.add(path);
    files.push({ path, content });
  }

  const main = cleanPath(String(body.main || files.find(x => EXTENSIONS.includes(ext(x.path)))?.path || files[0].path));
  if (!files.some(x => x.path === main)) throw new Error("Main source file is not included in the project.");

  const token = await appToken();
  const index = await readIndex(token);
  const id = slugify(name) + "-" + Date.now().toString(36) + "-" + crypto.randomUUID().slice(0, 8);
  const root = ROOT + "/" + id;
  const destinations = files.map(x => root + "/files/" + x.path);

  if ((index.projects || []).some((x: any) => x.id === id)) throw new Error("Project ID collision. Please publish again.");

  const manifest = {
    schema: 1,
    id,
    name,
    description,
    version,
    author: "SingulaX Community User",
    author_id: null,
    published: new Date().toISOString(),
    downloads: 0,
    likes: 0,
    main: root + "/files/" + main,
    files: destinations,
  };

  // Build one Git tree and one commit so the project, manifest, and index land together.
  const ref = await github("/repos/" + OWNER + "/" + REPO + "/git/ref/heads/" + BRANCH, token);
  const baseCommit = await github("/repos/" + OWNER + "/" + REPO + "/git/commits/" + ref.object.sha, token);
  const treeEntries: any[] = [];

  const manifestBlob = await blob(token, JSON.stringify(manifest, null, 2));
  treeEntries.push({ path: root + "/project.json", mode: "100644", type: "blob", sha: manifestBlob.sha });

  for (const file of files) {
    const b = await blob(token, file.content);
    treeEntries.push({ path: root + "/files/" + file.path, mode: "100644", type: "blob", sha: b.sha });
  }

  const nextIndex = { ...index, projects: [...(index.projects || []), { ...manifest, _path: root, _id: id }] };
  const indexBlob = await blob(token, JSON.stringify(nextIndex, null, 2));
  treeEntries.push({ path: ROOT + "/index.json", mode: "100644", type: "blob", sha: indexBlob.sha });

  const tree = await github("/repos/" + OWNER + "/" + REPO + "/git/trees", token, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: treeEntries }),
  });

  const commit = await github("/repos/" + OWNER + "/" + REPO + "/git/commits", token, {
    method: "POST",
    body: JSON.stringify({
      message: "Publish SingulaX Community project: " + name,
      tree: tree.sha,
      parents: [ref.object.sha],
    }),
  });

  await github("/repos/" + OWNER + "/" + REPO + "/git/refs/heads/" + BRANCH, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commit.sha, force: false }),
  });

  return json({ ok: true, id, name, version, author: manifest.author });
}

export default {
  fetch: withSupabase({ auth: "publishable" }, async (req, ctx) => {
    if (req.method !== "POST") return json({ error: "POST required." }, 405);
    try {
      return await publish(req, ctx);
    } catch (error) {
      console.error(error);
      return json({ error: error instanceof Error ? error.message : "Publish failed." }, 400);
    }
  }),
};
