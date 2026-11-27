---
name: work-rules-ui-automation
description: Traps when driving COM or UI Automation from PowerShell on Windows - a child runspace silently breaks COM late-binding, an elevated process cannot attach a non-elevated app, property reads need the GetProperty flag, and PowerShell passes $null to a C# string as "". Read in full before automating Office, Hangul or any GUI app through COM, UI Automation, GetActiveObject or InvokeMember. Triggers - COM 자동화, UI 자동화, 원격 조작, Office COM, GetActiveObject, InvokeMember, Add-Type 헬퍼.
---

# work-rules-ui-automation - COM and UI Automation from PowerShell

Rules: UI-1..UI-4 (4). Moved out of `work-rules-shell` on 2026-11-07, where they were SH-35..SH-38 (measured 2026-10-25 and 2026-10-26, REA Adapter remote operation and AppHelm). Shell, git and encoding traps stay in `work-rules-shell`; launching a GUI app from the PowerShell tool is its SH-32.

**UI-1 A child runspace (`[PowerShell]::Create()`) silently breaks COM late-binding.** `InvokeMember` on a COM object inside a `BeginInvoke`'d runspace returns `null` and the call is a no-op, even with `ApartmentState='STA'` and no exception thrown — so an automation "succeeds" (ok) while nothing happens and every property reads null. The same code on the main thread (also STA) works (measured: `FileSystemObject.Drives.Count` = 4 on main, null in runspace). Run COM on the host's main STA thread; use a runspace only for things that must time out (a blocking COM call then risks wedging the thread — avoid the block instead, see UI-3).

**UI-2 An elevated process cannot COM-attach a non-elevated app.** `Marshal::GetActiveObject("App.Application")` throws `MK_E_UNAVAILABLE (0x800401E3)` because the Running Object Table is filtered by integrity level. Run the automating process at the **same** integrity as the target app (a user's Office runs non-elevated → automate non-elevated). UI Automation is not blocked this way (higher IL reads lower), so a UIA click can succeed from an elevated process while COM attach fails — a misleading split. A non-elevated `HttpListener` bound to a non-loopback address then needs a one-time `netsh http add urlacl url=http://<addr>:<port>/ user=<user>` (admin once); loopback needs none.

**UI-3 COM late-binding reads need the `GetProperty` flag, and a blocked target hangs the call.** `InvokeMember(name, InvokeMethod, …)` on a property returns null; use `[Reflection.BindingFlags]'InvokeMethod,GetProperty'` for no-arg members so properties (`Version`, `ActiveDocument.Name`, `Count`) return values — essential for verifying you attached to the right instance before acting, and reading back after. A target showing a modal/guard state (Word "Protected View") blocks COM until cleared; clear it via UIA first (find and Invoke the button) rather than COM. `GetActiveObject` returns one ROT instance, which may not be the visible document when several are open — read `ActiveDocument.Name` to confirm.

**UI-4 PowerShell passes `$null` to a C# `string` parameter as `""` (measured 2026-10-26).** An `Add-Type` helper guarded by `title != null` treated every pid lookup as a search for an empty title, so AppHelm's screenshot-by-process never matched and only title lookups worked. Test with `String.IsNullOrEmpty`.

## How this file changes

A new trap revises the rule it belongs to in one or two lines with its measured date (`ai-characteristics` AI-17); a new rule updates the header count.
