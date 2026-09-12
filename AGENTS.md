# Agent operating contract

For any agent working in this repo or in a project copied from it. It points at
the rules; it does not restate them.

## The spec is law

**[ARCHITECTURE.md](ARCHITECTURE.md) governs.** Read it before proposing anything
structural. Where this file and the spec disagree, the spec wins. A project that
needs to deviate records the deviation in its own `AUDIT.md` with a reason; it
does not edit the spec in place — the canonical copy is the outredge-system
template.

## Verification

**`npm run verify` must pass before any phase gate.** It is the gate, not a
formality.

**Never weaken a check to make it pass.** Widening an allowlist, lowering a
threshold, deleting an assertion or narrowing a page list to get to green is
falsifying the result. If a check is wrong, say so and argue it; if the code is
wrong, fix the code.

**Any new check must demonstrate its own failure mode before it counts** (§9):
inject the fault it exists to catch, watch it fail with a legible message and a
non-zero exit, revert. A check whose red path has never run is an assertion about
the harness, not about the code. A check that cannot be made to fail does not
belong in the suite — say so and remove it rather than leaving an unfalsifiable
green line in the report.

**Read built output, not source.** Most of what this system has got wrong was
invisible in source and obvious in `dist/`. §2's thesis is that the compiler's
reality outranks the documentation in your head.

## Phase discipline

Work is phase-gated. **Stop at each gate and report. Only the human closes a
phase.** Do not start the next phase because the current one went well.

Deliver the whole scope of the phase you were given, and no more. If part of it
turns out to be blocked, finish everything else and say plainly what you left and
why — scaling the work down is the human's call.

## WORKLOG.md

**Append-only.** Never edit or delete an earlier entry; a correction is a new
entry that supersedes the old one. Record decisions with their reasoning, bugs
with their root cause, measured numbers, and numbered open questions. Deviations
from an instruction are recorded as deviations, not quietly absorbed.

## Never touch

- **DNS, hosting dashboards, accounts, signups, billing, domain registrars.**
  These are named human punch-list items. Do not attempt them, and do not ask for
  credentials.
- **Secrets.** Keys live in the environment. Nothing secret enters this repo, in
  any file, ever.
- **Reference repositories** (`../` siblings supplied as prior art). Read-only,
  always, unless the human explicitly instructs otherwise for a specific file.
- **`git push`, tags, releases, and history rewrites** without being asked.

## Scope

- Dependencies are **default no**. Each one is justified in the commit that adds
  it.
- Every script is a ruling, not a habit (§6). New JavaScript is declared in the
  census with a reason and a budget before it ships.
- Build what the work requires. Do not invent components, tokens or abstractions
  ahead of a demonstrated need (§4.2, §4.5).
