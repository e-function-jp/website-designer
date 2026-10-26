---
name: website-designer-learning-loop
description: "Use when operating, repairing, reviewing, or handing off the Website Designer learning loop and its Hermes cron jobs."
version: 1.0.0
---

# Website Designer Learning Loop

## When to use

Use this skill for Website Designer learning runs, reference-site analysis, multi-direction art direction, quality checks, cron failures, and handoff work.

## Paths

- Repository: `/Users/estaff-agent/Workspace/website-designer`
- Pipeline: `docs/learning-pipeline.md`
- Run state: `docs/quality/run-state.json`
- Quality report: `docs/quality/latest.md`
- Runs: `docs/quality/runs/`
- Live Hermes scripts: `~/.hermes/scripts/website-*.sh`
- Git snapshots of those scripts: `docs/hermes/runtime-snapshots/scripts/`

## Authoritative instructions

Read these before acting:

1. `AGENTS.md`
2. `docs/learning-pipeline.md`
3. `.claude/skills/frontend-design-web/SKILL.md`
4. `.claude/skills/web-implementation-tips/SKILL.md`
5. `docs/hermes/HANDOFF.md`

Repository code and pipeline docs override old sessions and this handoff snapshot.

## Safe operating sequence

1. Run `git status --short --branch` and preserve all existing changes.
2. Inspect `docs/quality/run-state.json` and the target run directory before allocating a new run ID.
3. Keep one fictional company setup fixed while comparing design directions.
4. Measure the reference site, write implementation-ready art direction, implement, independently review, fix, and then run the quality gates.
5. Validate with `npm run check:all`; use narrower checks only while diagnosing.
6. Record the result and failure state honestly. A selected run ID is not proof that the run completed.

## Playwright recovery

If motion analysis reports a missing `chromium_headless_shell`, run this from the repository:

```sh
npx playwright install chromium
```

Then rerun the failing analysis or the no-agent learning script. Do not create another run until the partial run has been reconciled.

## Cron operations

The primary jobs are `website-designer-learning-loop-daily` and `website-designer-health-check`. Inspect them with `hermes cron list --all`. The global gateway must be running for schedules to fire, but it should only be started deliberately with `hermes gateway start`.

## Git safety

The long-running learning worktree may contain many local commits and untracked run artifacts. Never reset, clean, checkout over, or broadly stage it. Use a separate worktree for isolated documentation or maintenance commits.

## Security

Do not write credentials, `.env` contents, browser profiles, cookies, or Hermes databases into the repository. Session exports must use `--redact` and be scanned before commit.
