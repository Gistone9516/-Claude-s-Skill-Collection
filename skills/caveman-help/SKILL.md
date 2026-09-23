---
name: caveman-help
description: >
  Quick-reference card for caveman modes, skills and commands.
  Trigger: /caveman-help or "caveman help".
---

# Caveman Help

Display this reference card when invoked. One-shot — do NOT change mode, write flag files, or persist anything. Output in caveman style.

## Modes

| Mode | Trigger | What change |
|------|---------|-------------|
| **Lite** | `/caveman lite` | Drop filler. Keep sentence structure. |
| **Full** | `/caveman` | Drop articles, filler, pleasantries, hedging. Fragments OK. Built-in default. |
| **Ultra** | `/caveman ultra` | Extreme compression. Bare fragments. No invented short forms, no arrows (CM-6, CM-7). |
| **Wenyan-Lite** | `/caveman wenyan-lite` | Classical Chinese style, light compression. |
| **Wenyan-Full** | `/caveman wenyan` | Full 文言文. Maximum classical terseness. |
| **Wenyan-Ultra** | `/caveman wenyan-ultra` | Extreme. Ancient scholar on a budget. |

Mode stick until changed or session end (CM-28).

## Skills

| Skill | Trigger | What it do |
|-------|---------|-----------|
| **caveman-commit** | `/caveman-commit` | Terse commit messages. Conventional Commits. ≤50 char subject. |
| **caveman-review** | `/caveman-review` | One-line PR comments: `L42: bug: user null. Add guard.` |
| **caveman-compress** | `/caveman-compress <file>` | Compress .md files to caveman prose. |
| **caveman-help** | `/caveman-help` | This card. |

## Deactivate

Say "stop caveman" or "normal mode". Resume anytime with `/caveman`.

## Language

Rules live in the caveman skill, not here: CM-19 keeps the user's language, CM-20 compresses
the style and never the language, CM-21 makes the wenyan levels the one exception, CM-22 to
CM-25 cover Korean. Read them there rather than restating them; the two copies drifted before
this was consolidated on 2026-09-23.

## Configure Default Mode

Built-in default = `full`. Four things are consulted, highest priority first.

**1. Environment variable**
```bash
export CAVEMAN_DEFAULT_MODE=ultra
```

**2. Repo-local config**, `.caveman/config.json` or `.caveman.json`, searched upward from the session's directory. Checks in a per-project default.

**3. User config file.** The path depends on the platform:

| Condition | Path |
|---|---|
| `XDG_CONFIG_HOME` set | `$XDG_CONFIG_HOME/caveman/config.json` |
| Windows | `%APPDATA%\caveman\config.json` |
| otherwise | `~/.config/caveman/config.json` |

```json
{ "defaultMode": "lite" }
```

**4. Built-in `full`** when none of the above matches.

Set `"off"` at any of the three levels to stop auto-activation at session start. The user can still turn it on for one session with `/caveman`.

## More

Full docs: https://github.com/JuliusBrussee/caveman
