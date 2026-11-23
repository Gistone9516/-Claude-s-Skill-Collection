---
name: work-rules-shell
description: Shell, git and terminal discipline for this environment (Windows 11 + PowerShell 5.1 + the Bash/WSL tool + non-ASCII paths). A card of the traps that cost the most, with the full catalogue in reference/rules.md. Read before running PowerShell, Bash or WSL commands, before git commit / stash / checkout, before writing inline shell or an edit script, and before moving a project folder. Triggers - shell 명령, git 작업, WSL, 터미널, PowerShell, 커밋, 폴더 이동, "run command", 스크립트 실행.
---

# work-rules-shell — card

Rules: SH-1..SH-39 (35). Full text, measured incidents and workarounds: `reference/rules.md`. Open the section named below when that situation is in front of you.

The card is 12 lines because thirteen rules are already enforced by hooks (`scripts/guard.ps1`, `scripts/pattern-guard.sh`) at the moment of use; it keeps the rules with no mechanical signature and the data-loss ones (2026-11-21, card size chosen per skill).

1. SH-1, SH-33: no complex inline shell. Anything with quotes, Korean, a heredoc or a backslash goes into a script file written with the Write tool, then run. SH-29: the Write tool adds no BOM, so PowerShell 5.1 reads a `.ps1`'s Korean as cp949 and silently writes garbage (2026-11-23, into Cloa's live state; repeat). Korean work goes in a Python script (`encoding='utf-8'`), or the `.ps1` stays ASCII and takes Korean as arguments.
2. SH-3: edit scripts assert the anchor count (`assert s.count(anchor) == 1`) and never restate the anchor in what they insert. A `# comment` appended to a replacement inside a one-line PowerShell block comments out the closing braces after it; put the comment after the last `}` of the line, and parse the file before running it (2026-11-23, three times in one session, once took the daemon down).
3. SH-4: never `Get-Content -Raw | Set-Content`; it destroys UTF-8. Use the Edit tool or Python with `encoding='utf-8'`.
4. SH-7: no git stash, checkout or restore while parallel agents or another session work in the repo; stage explicit paths, never `git add -A` over a shared folder.
5. SH-12: the console is cp949. Write Korean results to a UTF-8 file and keep stdout ASCII.
6. SH-13, SH-14: commit messages and multi-argument calls go through `git commit -F -` from a script file, not inline quotes.
7. SH-22: `git add` refuses the whole list if one path is ignored; check with `git check-ignore` first. `~/.claude` ignores everything not allowlisted in its `.gitignore`.
8. SH-23: update the root README before a commit that changes structure, features or how to run, and say whether it was updated. Never commit in the same call as the tests that justify it.
9. SH-26: write `git -C <repo> ...`, not `cd <repo> && git ...`.
10. SH-32: the PowerShell tool runs elevated. Mapped drives, GUI apps and Credential Manager live on the user's token; reach them through a `/rl LIMITED /it` scheduled task.
11. SH-5, SH-6, SH-8, SH-9: long paths, denied folders and hidden files make walks and deletes fail silently. Read reference sections 1-2 before any bulk delete or drive scan.
12. SH-24, SH-25: before moving a project folder, grep for its absolute path and rename its `~/.claude/projects/<key>` folder too. Reference section 5.

## Where the rest is

| Situation | Reference section |
|---|---|
| Writing or running any script, escapes, edit scripts | 0 |
| Deleting, long paths, encoding round-trips | 1 |
| Counts that look wrong, drive scans, PowerShell variables, elevation | 2 |
| Parse failures, `.bat`, `.ps1` BOM, WSL, Node on Korean paths, npm from PowerShell, ssh keys | 3 |
| git line endings, prettier, blocked destructive verbs, README floor | 4 |
| Moving a project folder | 5 |

A new trap revises its rule in `reference/rules.md` in one or two lines with its measured date (AI-17). Promote it to this card only if it costs data or a whole run.
