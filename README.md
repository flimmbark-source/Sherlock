# Enigma Painting – Key Mask (Web + Python)

## Quickstart
- **Web**: `npm ci && npm run dev` (Next.js 14). Paths like `@/components/ui` assume shadcn/ui present.
- **Python**: `python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`

## Codex/ChatGPT Audit
- Generate a context-rich prompt from your repo:
  - `npm run audit:prompt` → prints to console
  - `npm run audit:save` → writes `CODEx_PROMPT.out.md`
- Copy the output into ChatGPT and ask for a **Setup Gaps / Fix Plan / Ready Checklist**.

## CI
- Node: typecheck, lint, build.
- Python: import checks + smoke run (`scripts/smoke_enigma.py`).

## Notes
- Provide `public/Key.png` or adjust image path for both Python & Web builds.
