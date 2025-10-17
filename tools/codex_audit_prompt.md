# Codex/ChatGPT Repo Audit Prompt (Copy-Paste into ChatGPT)
You are an expert build/release engineer and senior full-stack dev.
Goal: tell me **exactly** what is missing/broken to set up this repo locally and in CI.

Context:
- Frontend: Next.js + React + d3-delaunay; shadcn UI paths like "@/components/ui".
- Python prototype: Shapely/Matplotlib mask pipeline.

Tasks:
1) Produce a bullet list “Setup Gaps” (missing files, scripts, env vars, assets like /mnt/data/Key.png).
2) Produce a “Fix Plan” with explicit file diffs or new files.
3) Verify the React <-> Python parity for: key mask extraction, region tagging, numbering, SVG/JSON structure.
4) Note any security/size/CPU footguns (e.g., marching squares perf, Path2D hit tests).
5) Output a final “Ready Checklist” to confirm a clean `npm run build` + Python smoke run.

Repo snapshot (file list and key snippets) is appended after this prompt.
