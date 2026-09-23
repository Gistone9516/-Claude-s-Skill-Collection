# caveman

Talk like smart caveman. Same brain, fewer tokens.

## What it does

Compress model responses to caveman-style prose by dropping articles, filler,
pleasantries, and hedging. Instruction preserves technical detail, code blocks,
error strings, and symbols. Result depends on model and workload; no aggregate
reduction or quality-equivalence claim is published, and mode persists until
changed or stopped.

Six intensity levels:

| Level | What change |
|-------|-------------|
| `lite` | Drop filler/hedging. Sentences stay full. Professional but tight. |
| `full` | Default. Drop articles, fragments OK, short synonyms. |
| `ultra` | Bare fragments. Standard acronyms only (DB, API, HTTP). No invented short forms, no arrows. |
| `wenyan-lite` | Classical Chinese register, light compression. |
| `wenyan-full` | Maximum 文言文 compression. |
| `wenyan-ultra` | Extreme classical compression. |

Auto-clarity rule: caveman drops to normal prose for security warnings, irreversible-action confirmations, multi-step sequences where fragment ambiguity risks misread, and when user repeats a question. Resumes after the clear part.

## How to invoke

```
/caveman              # full mode (default)
/caveman lite         # lighter compression
/caveman ultra        # extreme compression
/caveman wenyan       # classical Chinese
stop caveman          # back to normal prose
```

## Example output

Question: "Why does my React component re-render?"

Normal prose:
> Your component re-renders because you create a new object reference each render. Wrapping it in `useMemo` will fix the issue.

Caveman (full):
> New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`.

Caveman (ultra):
> Inline obj prop, new ref, re-render. `useMemo`.

## Fork

Forked from [JuliusBrussee/caveman](https://github.com/JuliusBrussee/caveman) v2.7.0 (MIT) on
2026-09-23. The rules were given IDs (CM-1..CM-28), the body was rewritten in plain English,
duplicate rule lists were merged, and Korean compression rules were added. `RULES.md` records
every change with its reason, and `manifest.json` declares the ID range so a session-start
check catches it when the count and the body disagree.

## See also

- [`SKILL.md`](./SKILL.md): the rules themselves, injected into context when a level is active
- [`RULES.md`](./RULES.md): source, rationale and test per rule, plus the config paths and the constraints on editing `SKILL.md`
