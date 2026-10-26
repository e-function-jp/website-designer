# Website Designer Hermes handoff

Snapshot: 2026-10-26 21:28 JST

## Current state

- Repository: `/Users/estaff-agent/Workspace/website-designer`
- Local branch at snapshot: `main`, 31 commits ahead of `origin/main`
- Local HEAD: `ac0a14e chore(run): contenna 参照ランの1回目の実装とディレクションを記録に残す`
- Remote base used for this handoff branch: `fe661f1`
- Existing local worktree: 81 status entries, including modified tracked files and untracked runs through 2026-10-26
- Latest selected run: `corporate-20261026-0510`, education-service, reference `株式会社スマイルバトン`
- Last readable quality report: 100/100 at 2026-09-26 05:18 JST
- Global Hermes gateway is intentionally stopped, so configured cron jobs will not fire.

The local worktree contains work that is not part of this documentation branch. Do not reset, clean, switch, or mass-stage it. Inspect and preserve it before any integration work.

## Active blocker

The 2026-10-26 daily run failed during reference-motion measurement because Playwright could not find Chromium at its expected cache path:

`~/Library/Caches/ms-playwright/chromium_headless_shell-1234/...`

The run had already updated selection state to `corporate-20261026-0510`. Treat that run as partial until its output and state are reconciled.

## Scheduled jobs

| Job | ID | Schedule | Last result |
|---|---|---|---|
| `website-designer-learning-loop-daily` | `71a38f0e7bc3` | daily 05:00 JST | 2026-10-26 failed: Chromium missing |
| `website-designer-health-check` | `df657dd689a8` | daily 01:40 JST | 2026-10-26 completed |
| `website-codex-probe` | `93f5c380d09e` | yearly probe | 2026-09-19 completed |

The live no-agent scripts are outside the repository under `~/.hermes/scripts/`; exact snapshots are retained in `docs/hermes/runtime-snapshots/scripts/`.

## Resume checklist

1. Preserve the current local worktree and review `git status --short --branch` plus `git log --oneline origin/main..HEAD`.
2. Read `AGENTS.md`, `docs/learning-pipeline.md`, `docs/quality/run-state.json`, and the latest run directory.
3. Restore the matching Playwright browser with `npx playwright install chromium` from the repository directory.
4. Run `npm run check:all` before manually restarting the learning script.
5. Resume art-direction context with `hermes --resume 20261020_051546_e1b5cf`, or read the exports in `docs/hermes/sessions/` on another machine.
6. Run `bash ~/.hermes/scripts/website-designer-learning-loop.sh` only after deciding whether to continue or replace the partial `corporate-20261026-0510` run.
7. Start automatic schedules only when intended: `hermes gateway start`, then verify with `hermes gateway status` and `hermes cron list --all`.

## Guardrails

- Never use `git clean`, `git reset --hard`, or a broad `git add -A` against the current local worktree.
- The repository pipeline and run metadata are authoritative. Session exports are supporting evidence.
- Keep company setup fixed across compared design directions.
- Do not mark the partial 2026-10-26 run complete solely because it appears in `run-state.json`.
- Never commit provider credentials, browser profile data, `.env`, or Hermes databases.
