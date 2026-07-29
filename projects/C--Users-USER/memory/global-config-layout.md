---
name: global-config-layout
description: "How the ~/.claude install is organized after the 2026-07-29 reorganization - two layers, stable rule IDs, and the manifest that validates it"
metadata: 
  node_type: memory
  type: project
  originSessionId: 8252f0cd-e017-4594-b708-72b1f7bdff65
  modified: 2026-07-29T13:26:32.595Z
---

`~/.claude` is a git repo (`Gistone9516/-Claude-s-Skill-Collection`) reorganized on 2026-07-29.

**Two layers.** `CLAUDE.md` holds only what must be true before a skill is read (27 rules, `G-01`..`G-27`); everything else lives in a skill loaded at its trigger. Before the reorganization CLAUDE.md had grown to 17,848 bytes by accretion; it is now 8,555 with no rule dropped.

**Why:** the accretion was the rule corpus committing the exact failure its own G-18 forbids — one file grown by appending until the important rules were buried.

**How to apply:**
- Rules carry stable IDs — `G-` global, then `SH` shell, `DG` diagnosis, `VF` verify, `AU` automation, `WR` writing, `DC` docs, `KT` kit, `AO` agent-ops, `DF` deepflow, `BF` buildflow, `HX` hwpx. Cite the ID instead of re-quoting the rule.
- Each skill states its rule count in the header. A count that no longer matches means a rule was added or lost silently.
- `manifest.json` declares every skill, file, external app path and settings key the install must have. `scripts/check-manifest.ps1` validates it at SessionStart and injects a warning listing anything missing, unregistered, or over budget. Run it manually with `-Mode report`.
- Adding or retiring a skill means editing `manifest.json` in the same commit, otherwise the next session flags it as unregistered.
- Human-facing explanation of all of this is `GUIDE.ko.md`, in Korean. Everything the model reads is English (G-01).

The `custom skill docs/` folder and its `sync-check.ps1` hook were retired in the same change: they were a second Korean copy of three skill bodies, all three drifted, kept in step by a hook that only nagged. `GUIDE.ko.md` replaces them without duplicating any skill body.

Related: [[user-profile]]
