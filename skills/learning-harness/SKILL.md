---
name: learning-harness
description: Runs the learning-harness kit against a subject folder. v6 (current) is a web "linked cycle" trainer - the AI gives one unit with no explanation, the learner runs it in an in-page terminal on a VMware lab VM and explains it, the AI only judges. v5 (legacy, kept) powers the /study concept-and-problem web via its gateway. Use for "start the learning server", "add a subject", "run v6", "학습 서버 켜줘", "과목 추가", or any edit to this kit.
---

# learning-harness (global skill)

The kit is installed here:

```
APP = F:\SUAN\claude\learning-harness
```

## Two generations live in one repo

| | v6 (current) | v5 (legacy, kept running) |
|---|---|---|
| Code | `lh/` (Python), `web/src/cycle`, `web/src/parts/terminal` | `bot/`, `engine/`, `tools/gateway`, other `web/src/*` |
| Spec | `specs/v6/` (`_인터페이스계약.md` wins on conflict) | `specs/*.md` |
| Serves | cycle screen `/cycle.html` from `lh.server` | `/study` via `tools/gateway` (subjects in `F:\SUAN\claude\_study-gateway\gateway.json`) |

The user does not use v5 and plans to move `/study` and `learn-topic.py` to v6 later (see `docs/인계_다음작업_@v2.md`). Until then, never delete or break v5 files: the gateway runs from them.

## Governance (hard rules)

- **One code copy, subjects are data.** A subject folder holds `config/subject.json`, `lab/*.sh`, `.env` (VM key) and `_state/`. No code.
- **Zero subject literals in kit code.** `lh/tests/test_subject_agnostic.py` (v6) and `bot/tests/test_subject_agnostic.py` (v5) fail on leakage. Subject wording, areas, unit rules, lab topology go in the subject config.
- **Spec before code.** v6 behaviour rules carry IDs (IF-, CO-, ME-, VM-, SV-, WB-). Change the spec first, then code, then tests named after the rule.
- **Information overload is the failure this kit exists to prevent, and the AI is a guide.** Before the learner arrives, AI output only points the way (verdict paragraph, hint, term meaning on tap). Full explanation comes only as the destination explanation after the learner arrives, moves on or gives up, folded behind a summary (plan `docs/기획_v6_사이클_@v6.md` section 0, core rules 2, 3, 11 to 18 in `lh/core/prompts/base.txt`). Do not add explanations anywhere else.

## Running v6

1. Once per machine: `python -m venv .venv` then `.venv\Scripts\python.exe -m pip install -r requirements-v6.txt`; in `web/`: `npm install` and `npm run build`.
2. Lab VM: see `lh/vm/provision/README.md` (`setup-vm.sh` does accounts, keys, sudo, shell integration).
3. Start **without admin rights** (an elevated vmrun cannot revert or start a VM the VMware window holds: "The file is already in use"):
   ```
   set LH_SUBJECTS=<subject folder>[;<another>]
   set LH_TOKEN=<token1>,<token2>      (one per device)
   set LH_BIND=<Tailscale IP or 127.0.0.1>
   .venv\Scripts\python.exe -m lh.server
   ```
   The pilot launcher is `F:\SUAN\lh-subjects\start-linux-net.cmd`.
4. Open `http://<bind>:<port>/cycle.html` and enter a token.

Test without VM or AI: `LH_VM_FAKE=1`, `LH_AI_FAKE=<folder of role.txt files>`.

## Adding a v6 subject (no kit edits)

Copy `F:\SUAN\lh-subjects\linux-net` as a template: edit `config/subject.json` (areas, persona, `prompts.*`, `unit_rule`, `final_task`, `vm`), the `lab/*.sh` scripts and `.env`. A second subject needs its own VM (`vm.vmx` and `vm.host` must differ, VM-1).

## Notes

- Run `python "F:\SUAN\claude\learning-harness/skills/install.py"` to regenerate this skill after editing `skills/SKILL.md`.
- Tokens and VM keys live only in launcher files and subject `.env`, never in the repo.
