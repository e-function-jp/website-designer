# Hermes skill management

## Repository-owned skills

The project already tracks two implementation skills:

- `.claude/skills/frontend-design-web/SKILL.md`
- `.claude/skills/web-implementation-tips/SKILL.md`

At the snapshot time, `hermes skills list` did not contain a dedicated Website Designer skill. `docs/hermes/skills/website-designer-learning-loop/` adds a Git-managed Hermes operations skill that points back to the authoritative repository pipeline and project skills.

## Install into Hermes

```sh
mkdir -p ~/.hermes/skills/software-development/website-designer-learning-loop
rsync -a --delete \
  docs/hermes/skills/website-designer-learning-loop/ \
  ~/.hermes/skills/software-development/website-designer-learning-loop/
hermes skills audit
hermes skills list
```

After validating any live edit, sync it back into the repository directory and commit it. The repository copy is the reviewable source of truth.

## Runtime script snapshots

Hermes cron refers to scripts outside this repository. The 2026-10-26 snapshots are retained under `docs/hermes/runtime-snapshots/scripts/`:

| Script | Live path | SHA-256 |
|---|---|---|
| `website-designer-learning-loop.sh` | `~/.hermes/scripts/website-designer-learning-loop.sh` | `1fee1f82135c2df5328ed96772260bf9d64ff77891ae715776207519f72dd650` |
| `website-designer-health-check.sh` | `~/.hermes/scripts/website-designer-health-check.sh` | `ec6b3b1b6c35d91b125d74b17d1b3f609e28112f76d1485e93a777c1d10970da` |
| `website-codex-probe.sh` | `~/.hermes/scripts/website-codex-probe.sh` | `0435d78031b529e18cbbde0acb540418d0c4ff203fcf955e2c7470cd10a62ecd` |

Do not store `.env`, provider tokens, browser profiles, or Hermes databases here.
