---
name: work-rules-kit
description: Rules for reusable kit and framework projects, where one copy of the code serves many instances or subjects - keep the kit generic and push every instance-specific value into config, .env or data. Read in full before touching a project built this way, such as learning-harness or Discord Agents. Triggers - learning-harness, Discord Agents, 킷 수정, 프레임워크 공용 코드, 인스턴스 추가, 과목 추가, kit, framework, shared code.
---

# work-rules-kit — reusable kit and framework projects

Rules: KT-1..KT-4 (4).
Applies to any project built as a reusable kit consumed by several instances or subjects, such as `learning-harness` and `Discord Agents`.

**KT-1 Kit code stays generic — zero instance literals.** Everything specific to an instance (subject or area names, personas, task wording, channel, token, guild, roster, working folder) is injected through config, `.env` or data. None of it is hardcoded into shared kit code.

**KT-2 Never fork or clone the code per instance.** One copy of the code serves every instance. Instances differ only in data, config and `.env`. Running an instance means pointing the single kit at that instance's data folder, whose `.env` supplies the channel and token.

**KT-3 While working on one instance, do not push that instance's specifics into the kit.** Doing so changes files every other instance depends on. Kit edits are for generic framework features; an instance-specific change belongs in that instance's config or data.

**KT-4 Guard it with a test that fails when an instance literal leaks into kit code.** `learning-harness` has `bot/tests/test_subject_agnostic.py` for exactly this. A rule enforced by a test cannot be forgotten by the next session — the same reasoning as `work-rules-diagnosis` DG-3, preferring impossible over checked.
