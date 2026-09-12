# WORKLOG

Append-only. Newest entries at the bottom.

This file is the project's memory: why something is the way it is, what broke and
why, and what is still undecided. It is not a changelog — `git log` already does
that. It exists because the reasoning behind a decision outlives the person who
made it, and because a bug fixed without its root cause recorded is a bug that
comes back wearing a different hat.

## Rules

- **Append-only.** Never edit or delete an earlier entry. A correction is a NEW
  entry that supersedes the old one, and says so. The record of having been wrong
  is part of the record.
- **Decisions carry their reasoning**, not just their outcome. "Chose X" is
  useless in six months; "chose X because Y, having measured Z" is not.
- **Bugs carry their root cause**, and the symptom that led to it.
- **Measurements are numbers**, with the conditions they were measured under.
- **Open questions are numbered** and stay numbered, so a later entry can close
  one by name.
- **Deviations from an instruction are recorded as deviations**, not quietly
  absorbed.

`AUDIT.md` is the companion file for findings and sanctioned deviations from
`ARCHITECTURE.md`. Create it when there is a first one.

---

## Template provenance

This project was created from the **outredge-system** template. The build record
for the system itself — every decision, every bug with its root cause, and the
eleven defects the harness caught before any client project existed — lives in
that repository's own WORKLOG at tag `v1.1.0`. It is worth reading once before
deviating from `ARCHITECTURE.md`.

Entries below are about **this project**.

---

## YYYY-MM-DD — Entry 0. Project start

*(Replace this. First entry records: the client, the scope, the inputs received —
brand primitives, fonts, logo, content model, domain — and anything agreed that
is not in a brief.)*
