# Hermes session index

Exports were generated on 2026-10-26 with `hermes sessions export --format md --redact`. The latest scheduled job is a no-agent shell execution, so its Playwright failure is documented in `HANDOFF.md` rather than represented by an agent session.

| Session ID | Purpose | Messages / tools | Export |
|---|---|---:|---|
| `20261020_050337_c4ad3d` | Fixed company setup for the compared directions | 2 / 0 | `sessions/20261020_050337_c4ad3d-session.md` |
| `20261020_050350_2290a9` | First art-direction pass | 18 / 12 | `sessions/20261020_050350_2290a9-session.md` |
| `20261020_050844_0dc4cc` | Second art-direction pass | 16 / 11 | `sessions/20261020_050844_0dc4cc-session.md` |
| `20261020_051546_e1b5cf` | Latest and most complete art-direction context | 25 / 18 | `sessions/20261020_051546_e1b5cf-session.md` |

## Resume command

```sh
cd /Users/estaff-agent/Workspace/website-designer
hermes --resume 20261020_051546_e1b5cf
```

Use the exported Markdown when the original Hermes state database is unavailable.
