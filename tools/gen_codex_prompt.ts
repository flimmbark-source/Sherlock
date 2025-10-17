/**
 * Generates a concise, Codex-ready prompt that includes a repo tree and key file snippets.
 * WHY: Gives AI enough context to tell you what's missing and how to fix it.
 */
import { readdirSync, statSync, readFileSync } from "fs";
import { join, relative } from "path";

const ROOT = process.cwd();
const MAX_SNIPPETS = 12;
const SNIPPET_BYTES = 2000;
const IGNORE = new Set(["node_modules", ".git", "dist", ".next", "coverage", "build", ".DS_Store"]);

type Entry = { path: string, size: number };
const entries: Entry[] = [];

function walk(dir: string) {
  for (const name of readdirSync(dir)) {
    if (IGNORE.has(name)) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else entries.push({ path: relative(ROOT, p), size: st.size });
  }
}
walk(ROOT);

function shouldSnippet(p: string) {
  return /\.(tsx?|py|json|ya?ml|toml|md|svg)$/.test(p);
}

const sorted = entries.sort((a, b) => a.path.localeCompare(b.path));
const fileList = sorted.map(e => `- ${e.path} (${e.size} B)`).join("\n");

const snippetCandidates = sorted.filter(e => shouldSnippet(e.path)).slice(0, 200);
const snippets: string[] = [];
for (const e of snippetCandidates.slice(0, MAX_SNIPPETS)) {
  let buf = readFileSync(e.path, "utf8");
  if (buf.length > SNIPPET_BYTES) buf = buf.slice(0, SNIPPET_BYTES) + "\n/* ...truncated... */\n";
  snippets.push(`\n--- SNIPPET: ${e.path} ---\n\`\`\`\n${buf}\n\`\`\`\n`);
}

const promptHeader = readFileSync(join("tools", "codex_audit_prompt.md"), "utf8");

const out = [
  promptHeader.trim(),
  "\n\n## REPO TREE",
  fileList,
  "\n\n## KEY SNIPPETS",
  snippets.join("\n")
].join("\n");

process.stdout.write(out);
