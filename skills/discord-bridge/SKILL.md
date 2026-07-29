---
name: discord-bridge
description: Mount the current working folder on Discord for remote conversation (light mode) or multi-agent orchestration (full mode). The Bridge "app" is installed in one place and targets any folder you run it against. Use for requests like "discord bridge", "put this folder on Discord", or "start remote session".
---

# discord-bridge (global skill)

The Discord Bridge "app" is installed in the folder below (code, skills, and token live here):

```
APP = C:\Users\USER\Desktop\2026-하계\Discord Agents
```

The app (code/token/skills) and data (working folder) are separate. Think of it like a document app installed once that can open any document. The app is fixed; only the working folder changes.

## Mounting the current folder on Discord (light mode)

Run the following from the target folder. That folder becomes the session working directory.

```
python "C:\Users\USER\Desktop\2026-하계\Discord Agents\bridge.py"
```

- Choose the mode as the first argument: light `python "..." light`, full `python "..." full`. If no mode is given, the value of BRIDGE_MODE in .env is used.
- The working folder is the current cwd (the folder you run from). You can also specify a folder path after the mode argument.
- To target a different folder: `python "C:\Users\USER\Desktop\2026-하계\Discord Agents\bridge.py" "D:\some\project"`.
- The bot token (.env) and skills are read from the APP folder, so no reconfiguration is needed per folder.
- You interact with a single session covering that folder via the Discord `#coordinator` channel.
- To stop: press Ctrl+C in the terminal. Only one bot instance can run at a time (single token).

## Argument reference

The session that reads this skill runs bridge.py from its working folder. Format:

```
python "C:\Users\USER\Desktop\2026-하계\Discord Agents\bridge.py" [mode] [workdir] [--resume]
```

- **mode**: `light` (single-session remote conversation) or `full` (multi-agent). Defaults to BRIDGE_MODE in .env if omitted.
- **workdir**: Defaults to the current folder (cwd). Just run from the folder you are working in and that folder becomes the target. Supply a path after the mode to target a different folder.
- **`--resume`** (or `-r`): **Continue the previous conversation** for this folder+mode. Without it, a new session starts. Session IDs are stored per folder/mode/role, so each folder keeps its own session.

Examples:
- Start a new light session in this folder: `python "C:\Users\USER\Desktop\2026-하계\Discord Agents\bridge.py" light`
- Resume a light session in this folder: `python "C:\Users\USER\Desktop\2026-하계\Discord Agents\bridge.py" light --resume`
- Full mode for a different folder: `python "C:\Users\USER\Desktop\2026-하계\Discord Agents\bridge.py" full "D:\some\project"`

Only one bot instance can run at a time (single token).

## Multi-agent (full mode)

- Place roster.json (coordinator + specialist repo list) in the working folder or APP folder, and set BRIDGE_MODE=full in the APP .env.
- Specialist workdirs are sub-folders relative to the working folder. A roster.json in the working folder takes priority over the app default.
- Per-folder front channels (#coord-<folder>) are created automatically. Each user instruction spawns a work thread on that message; all task output goes into the thread (the parent channel shows only instructions and global commands).
- The coordinator assigns work to specialists via ASSIGN; Bridge routes to #agent-<folder>-<repo> (specialist channel posts are silent). Specialist summaries are also posted to the work thread via webhook.
- Slash commands (/stop /status /file /peer /crosscheck) and magic words coexist. Choices use buttons/dropdowns; async decisions use native polls. Files are attached only on /file or explicit request.
- Autonomous loop -- run it directly from your own terminal.

## Re-inviting the bot (prerequisite for UI harness)

Threads, webhooks, files, and slash commands require permissions beyond the initial invite. Re-invite the bot using the link below (adds the required permissions and applications.commands scope). Without re-inviting, magic-word chat works but those features are disabled.

```
https://discord.com/api/oauth2/authorize?client_id=<BOT_CLIENT_ID>&permissions=326954511440&scope=bot+applications.commands
```

## How it works

All conversation passes through Bridge (relay and loop control). There is no direct user-to-coordinator or coordinator-to-specialist link. For detailed design see "architecture-design-v2.md" and the skills/ folder in APP.

## Notes

- Permissions, model, specialist count, and effort settings are in bridge.py / .env in APP.
- Secrets such as the bot token live only in APP/.env and are never exposed.
