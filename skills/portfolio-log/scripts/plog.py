"""portfolio-log 수집기.

Claude Code 세션 기록(~/.claude/projects/*/*.jsonl)에서 하루치 원재료를 뽑아
일지 폴더에 다이제스트(.md)와 메타(.json)로 남긴다. 규칙 번호(PL-*)는 SKILL.md 표를 따른다.

하위 명령
  collect     [--date YYYY-MM-DD]  하루치 다이제스트 생성
  set-folder  --cwd PATH --record yes|no [--public yes|no] [--target til|readme|both]
  errors      [--days N]           지난 N일(기본 30)의 에러 순간 목록 (PL-17)
  paths                            설정·일지 경로 출력
"""
import argparse
import glob
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone

# stdout은 cp949 콘솔에서 죽지 않도록 ASCII로만 쓴다 (PL-14). 한글은 파일로 간다.
try:
    sys.stdout.reconfigure(errors="backslashreplace")
except Exception:
    pass

DEFAULT_CONFIG = {"day_start": "05:30", "tz_offset_hours": 9, "folders": {}}

USER_TEXT_MAX = 2000
ASSISTANT_TEXT_MAX = 1500
EDIT_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}

# PL-6: 사람이 친 입력이 아닌 사용자 줄
SKIP_USER_PREFIXES = ("<task-notification", "<local-command")
STRIP_TAG_RE = re.compile(
    r"<(system-reminder|ide_selection|ide_opened_file|ide_diagnostics)>.*?</\1>", re.S
)
COMMAND_RE = re.compile(r"<command-name>(.*?)</command-name>", re.S)
COMMAND_ARGS_RE = re.compile(r"<command-args>(.*?)</command-args>", re.S)

# PL-7: 수집 단계에서 비밀값을 가린다
SECRET_RES = [
    re.compile(r"sk-[A-Za-z0-9_\-]{16,}"),
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    re.compile(r"github_pat_[A-Za-z0-9_]{20,}"),
    re.compile(r"AKIA[0-9A-Z]{16}"),
    re.compile(r"xox[abprs]-[A-Za-z0-9\-]{10,}"),
    re.compile(r"AIza[0-9A-Za-z_\-]{30,}"),
    re.compile(r"client_secret[\w.\-]*"),
    re.compile(r"https?://(?:\w+\.)?discord(?:app)?\.com/api/webhooks/\S+"),
]
SECRET_ASSIGN_RE = re.compile(
    r"(?i)((?:api[_-]?key|access[_-]?token|secret|password|passwd|token)\s*[:=]\s*)['\"]?[^\s'\"]{6,}['\"]?"
)


def mask(text):
    for r in SECRET_RES:
        text = r.sub("[MASKED]", text)
    return SECRET_ASSIGN_RE.sub(lambda m: m.group(1) + "[MASKED]", text)


def clip(text, limit):
    text = text.strip()
    if len(text) <= limit:
        return text
    return text[:limit] + " …(%d자 생략)" % (len(text) - limit)


def journal_dir(arg=None):
    return arg or os.environ.get("PORTFOLIO_JOURNAL_DIR") or os.path.join(
        os.path.expanduser("~"), "portfolio-journal"
    )


def config_path(jdir):
    return os.path.join(jdir, "config.json")


def load_config(jdir):
    cfg = dict(DEFAULT_CONFIG)
    cfg["folders"] = {}
    p = config_path(jdir)
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            cfg.update(json.load(f))
    return cfg


def save_config(jdir, cfg):
    os.makedirs(jdir, exist_ok=True)
    with open(config_path(jdir), "w", encoding="utf-8") as f:
        json.dump(cfg, f, ensure_ascii=False, indent=2)


def folder_key(cwd):
    """PL-4: 슬러그가 아니라 cwd로, 대소문자와 구분자를 무시하고 묶는다."""
    return re.sub(r"[\\/]+", "/", cwd or "").rstrip("/").lower()


def tz_of(cfg):
    return timezone(timedelta(hours=cfg["tz_offset_hours"]))


def day_start_delta(cfg):
    h, m = (int(x) for x in cfg["day_start"].split(":"))
    return timedelta(hours=h, minutes=m)


def logical_day(now, cfg):
    """PL-1: day_start 이전의 새벽은 전날로 센다."""
    return (now.astimezone(tz_of(cfg)) - day_start_delta(cfg)).date()


def window(day, cfg):
    start = datetime(day.year, day.month, day.day, tzinfo=tz_of(cfg)) + day_start_delta(cfg)
    return start, start + timedelta(days=1)


def parse_ts(s):
    """PL-2: 기록의 시각은 UTC(Z)다."""
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def user_text(msg):
    """사람이 친 입력이면 정리된 텍스트, 아니면 None."""
    content = msg.get("content")
    if isinstance(content, str):
        parts = [content]
    elif isinstance(content, list):
        if any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
            return None
        parts = [b.get("text", "") for b in content if isinstance(b, dict) and b.get("type") == "text"]
    else:
        return None
    text = "\n".join(parts)
    if text.lstrip().startswith(SKIP_USER_PREFIXES):
        return None
    cmd = COMMAND_RE.search(text)
    if cmd:
        args = COMMAND_ARGS_RE.search(text)
        return ("[명령] " + cmd.group(1).strip() + " " + (args.group(1).strip() if args else "")).strip()
    text = STRIP_TAG_RE.sub("", text).strip()
    return text or None


def scan_file(path, start, end, sessions):
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            try:
                o = json.loads(line)
            except ValueError:
                continue
            ts = parse_ts(o.get("timestamp"))  # PL-5
            if ts is None or not (start <= ts < end):
                continue
            if o.get("isSidechain") or o.get("isMeta"):  # PL-3, PL-6
                continue
            t = o.get("type")
            msg = o.get("message")
            if t not in ("user", "assistant") or not isinstance(msg, dict):
                continue
            sid = o.get("sessionId") or os.path.basename(path)
            s = sessions.setdefault(
                sid, {"id": sid, "cwd": o.get("cwd") or "", "first": ts, "last": ts, "turns": [], "files": []}
            )
            s["first"] = min(s["first"], ts)
            s["last"] = max(s["last"], ts)
            if not s["cwd"] and o.get("cwd"):
                s["cwd"] = o["cwd"]
            if t == "user":
                text = user_text(msg)
                if text:
                    s["turns"].append({"t": ts, "user": text, "answer": ""})
                continue
            for b in msg.get("content") or []:
                if not isinstance(b, dict):
                    continue
                if b.get("type") == "text" and b.get("text", "").strip() and s["turns"]:
                    s["turns"][-1]["answer"] = b["text"]  # 턴의 마지막 답변만 남는다
                elif b.get("type") == "tool_use" and b.get("name") in EDIT_TOOLS:
                    inp = b.get("input") or {}
                    fp = inp.get("file_path") or inp.get("notebook_path")
                    if fp and fp not in s["files"]:
                        s["files"].append(fp)


def git_commits(cwd, start, end):
    if not cwd or not os.path.isdir(cwd):
        return []
    try:
        r = subprocess.run(
            ["git", "-C", cwd, "log", "--all", "--since=" + start.isoformat(),
             "--until=" + end.isoformat(), "--pretty=format:%h %s"],
            capture_output=True, encoding="utf-8", errors="replace", timeout=20,
        )
    except (OSError, subprocess.SubprocessError):
        return []
    if r.returncode != 0:
        return []
    return [ln for ln in r.stdout.splitlines() if ln.strip()]


# PL-18: 후보 한 줄의 색인 칸. 이름은 work-panel의 Candidate(src/core.ts)와 같아야 한다.
CANDIDATE_FIELDS = [("task", "요청"), ("intent", "의도"), ("problem", "문제"),
                    ("outcome", "결과"), ("why", "가치"), ("evidence", "근거")]


def read_json_list(path):
    if not os.path.exists(path):
        return []
    try:
        with open(path, encoding="utf-8") as f:
            v = json.load(f)
    except ValueError:
        return []
    return v if isinstance(v, list) else []


def day_candidates(jdir, start, end):
    """PL-18, PL-19: 그날 창 안에 있고 아직 노트에 쓰지 않은 후보."""
    used = set(x for x in read_json_list(os.path.join(jdir, "candidates-used.json")) if isinstance(x, str))
    out = []
    for c in read_json_list(os.path.join(jdir, "candidates.json")):
        if not isinstance(c, dict) or c.get("id") in used:
            continue
        at = parse_ts(str(c.get("at", "")))
        if at is not None and start <= at < end:
            out.append(c)
    return out


def mark_used(day, cfg, jdir):
    """PL-19: 노트를 저장한 뒤, 그날 후보의 id를 candidates-used.json에 더한다. 후보 파일은 현황판만 고친다."""
    start, end = window(day, cfg)
    ids = [c["id"] for c in day_candidates(jdir, start, end) if isinstance(c.get("id"), str)]
    path = os.path.join(jdir, "candidates-used.json")
    used = [x for x in read_json_list(path) if isinstance(x, str)]
    merged = (used + [i for i in ids if i not in used])[-USED_LIMIT:]
    os.makedirs(jdir, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)
    return len(ids)


USED_LIMIT = 2000


def collect(day, cfg, projects_dir, jdir):
    start, end = window(day, cfg)
    sessions = {}
    # PL-3: 최상위 jsonl만. subagents/는 한 단계 더 아래라 이 glob에 걸리지 않는다.
    for path in glob.glob(os.path.join(projects_dir, "*", "*.jsonl")):
        try:
            if datetime.fromtimestamp(os.path.getmtime(path), timezone.utc) < start:
                continue  # PL-5: mtime은 후보 거르기에만 쓴다
        except OSError:
            continue
        scan_file(path, start, end, sessions)

    projects = {}
    for s in sessions.values():
        if not s["turns"] and not s["files"]:
            continue
        key = folder_key(s["cwd"])
        p = projects.setdefault(key, {"key": key, "cwd": s["cwd"], "sessions": []})
        p["sessions"].append(s)

    folders = cfg.get("folders", {})
    meta = {
        "date": day.isoformat(),
        "window": [start.isoformat(), end.isoformat()],
        "projects": [],
    }
    lines = ["# 원재료 다이제스트 %s (%s ~ %s)" % (day.isoformat(), start.strftime("%m-%d %H:%M"), end.strftime("%m-%d %H:%M")), ""]
    tz = tz_of(cfg)
    for key in sorted(projects):
        p = projects[key]
        conf = folders.get(key)
        status = "new" if conf is None else ("record" if conf.get("record") else "excluded")
        commits = git_commits(p["cwd"], start, end) if status != "excluded" else []
        files = sorted({f for s in p["sessions"] for f in s["files"]})
        meta["projects"].append({
            "key": key, "cwd": p["cwd"], "status": status,
            "sessions": len(p["sessions"]),
            "turns": sum(len(s["turns"]) for s in p["sessions"]),
            "files": files, "commits": commits,
            "public": (conf or {}).get("public"), "target": (conf or {}).get("target"),
        })
        if status == "excluded":  # PL-8: 제외 폴더는 내용을 남기지 않는다
            continue
        lines.append("## 프로젝트: %s%s" % (p["cwd"], "  [신규 폴더]" if status == "new" else ""))
        if files:
            lines.append("- 편집한 파일: " + ", ".join(files))
        if commits:
            lines.append("- 커밋: " + " / ".join(mask(c) for c in commits))
        lines.append("")
        for s in sorted(p["sessions"], key=lambda x: x["first"]):
            lines.append("### 세션 %s (%s~%s)" % (s["id"][:8], s["first"].astimezone(tz).strftime("%H:%M"),
                                                 s["last"].astimezone(tz).strftime("%H:%M")))
            for turn in s["turns"]:
                lines.append("[%s 사용자] %s" % (turn["t"].astimezone(tz).strftime("%H:%M"),
                                                 mask(clip(turn["user"], USER_TEXT_MAX))))
                if turn["answer"]:
                    lines.append("[Claude] " + mask(clip(turn["answer"], ASSISTANT_TEXT_MAX)))
                lines.append("")
    # PL-18: 현황판에서 사람이 고른 후보 중 그날 창 안의 것만, 색인 칸을 항목별로 넣는다
    picked = day_candidates(jdir, start, end)
    if picked:
        lines += ["## 기록 후보 (현황판에서 고름)", ""]
        for c in picked:
            at = parse_ts(str(c.get("at", "")))
            head = [at.astimezone(tz).strftime("%H:%M") if at else "",
                    os.path.basename(str(c.get("cwd", "")).rstrip("/\\")),
                    "세션 " + str(c["session"])[:8] if c.get("session") else ""]
            title = c.get("title") or c.get("text") or ""
            lines.append("- **%s** (%s)" % (mask(clip(str(title), 200)), ", ".join(h for h in head if h)))
            for key, label in CANDIDATE_FIELDS:
                if c.get(key):
                    lines.append("  - %s: %s" % (label, mask(clip(str(c[key]), 400))))
        lines.append("")
    out_dir = os.path.join(jdir, "digest")
    os.makedirs(out_dir, exist_ok=True)
    md_path = os.path.join(out_dir, day.isoformat() + ".digest.md")
    meta_path = os.path.join(out_dir, day.isoformat() + ".meta.json")
    body = "\n".join(lines) + "\n"
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(body)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)
    return meta, md_path, meta_path, len(body)


# PL-17: 지난 세션의 에러 순간. 사용자 지적은 표현으로 추정한 후보일 뿐이다.
ERROR_TEXT_MAX = 300
TASK_TEXT_MAX = 120
INTERRUPT_MARK = "[Request interrupted by user"
REJECT_RE = re.compile(r"doesn't want to proceed|tool use was rejected", re.I)
BLOCK_RE = re.compile(r"denied|blocked|permission|\[skill-gate\]", re.I)
CORRECTION_RE = re.compile(r"^\s*(아니|아냐)|틀렸|잘못|지어내|다시 해|별로|이상해|안 ?돼|왜 자꾸|왜 또")
CORRECTION_SCOPE = 200  # 첫 줄만 본다. 본문까지 훑으면 자동화 프롬프트나 코드 블록이 걸린다
HEADER_LINE_RE = re.compile(r"^(Exit code \d+|#+ ?Error:?|Error:?)$", re.I)


def first_line(text, limit):
    for ln in text.strip().splitlines():
        if ln.strip():
            return clip(ln, limit)
    return ""


def error_line(text, limit):
    """첫 줄이 'Exit code 1'이나 '### Error' 같은 머리말이면, 원인이 적힌 다음 줄을 붙인다."""
    lines = [ln.strip() for ln in text.strip().splitlines() if ln.strip()]
    if not lines:
        return ""
    head = lines[0]
    if HEADER_LINE_RE.match(head) and len(lines) > 1:
        return clip(head + ": " + lines[1], limit)
    return clip(head, limit)


def tool_result_text(block):
    c = block.get("content")
    if isinstance(c, str):
        return c
    if isinstance(c, list):
        return "\n".join(x.get("text", "") for x in c if isinstance(x, dict))
    return ""


def scan_errors(path, since, excluded, items):
    tools = {}
    task = ""
    with open(path, encoding="utf-8", errors="replace") as fh:
        for raw in fh:
            try:
                o = json.loads(raw)
            except ValueError:
                continue
            ts = parse_ts(o.get("timestamp"))
            if ts is None or ts < since or o.get("isSidechain") or o.get("isMeta"):
                continue
            if folder_key(o.get("cwd")) in excluded:  # PL-8: 제외 폴더는 남기지 않는다
                continue
            msg = o.get("message")
            if not isinstance(msg, dict):
                continue
            base = {"ts": ts, "session": (o.get("sessionId") or "")[:8], "cwd": o.get("cwd") or ""}
            content = msg.get("content")
            if o.get("type") == "assistant":
                for b in content or []:
                    if isinstance(b, dict) and b.get("type") == "tool_use":
                        tools[b.get("id")] = b.get("name", "")
                continue
            if o.get("type") != "user":
                continue
            if isinstance(content, list) and any(isinstance(b, dict) and b.get("type") == "tool_result" for b in content):
                for b in content:
                    if isinstance(b, dict) and b.get("type") == "tool_result" and b.get("is_error"):
                        text = tool_result_text(b)
                        kind = ("rejected" if REJECT_RE.search(text)
                                else "blocked" if BLOCK_RE.search(text) else "tool_error")
                        items.append(dict(base, kind=kind, tool=tools.get(b.get("tool_use_id"), ""),
                                          text=mask(error_line(text, ERROR_TEXT_MAX)), task=task))
                continue
            text = user_text(msg)
            if not text:
                continue
            if INTERRUPT_MARK in text:
                items.append(dict(base, kind="interrupted", tool="", text="", task=task))
                continue
            line_ = mask(first_line(text, TASK_TEXT_MAX))
            if CORRECTION_RE.search(first_line(text, CORRECTION_SCOPE)):
                items.append(dict(base, kind="correction", tool="", text=mask(first_line(text, ERROR_TEXT_MAX)), task=task))
            task = line_


def errors(days, cfg, projects_dir, jdir, now=None):
    now = now or datetime.now(timezone.utc)
    since = now - timedelta(days=days)
    excluded = {k for k, v in cfg.get("folders", {}).items() if not v.get("record")}
    items = []
    for path in glob.glob(os.path.join(projects_dir, "*", "*.jsonl")):  # PL-3
        try:
            if datetime.fromtimestamp(os.path.getmtime(path), timezone.utc) < since:
                continue
        except OSError:
            continue
        scan_errors(path, since, excluded, items)
    items.sort(key=lambda x: x["ts"])

    tz = tz_of(cfg)
    counts = {}
    repeats = {}
    for it in items:
        counts[it["kind"]] = counts.get(it["kind"], 0) + 1
        if it["kind"] in ("tool_error", "blocked", "rejected") and it["text"]:
            sig = (it["tool"], re.sub(r"\d+", "#", it["text"])[:80])
            repeats[sig] = repeats.get(sig, 0) + 1

    label = {"tool_error": "도구 에러", "blocked": "차단", "rejected": "사용자 거부",
             "interrupted": "중단", "correction": "지적 후보"}
    lines = ["# 지난 %d일 에러 순간 (%s 기준)" % (days, now.astimezone(tz).strftime("%Y-%m-%d %H:%M")), "",
             "- " + ", ".join("%s %d" % (label[k], counts.get(k, 0)) for k in label), "", "## 반복된 에러", ""]
    for (tool, sig), n in sorted(repeats.items(), key=lambda kv: -kv[1])[:15]:
        if n > 1:
            lines.append("- %d회 [%s] %s" % (n, tool or "?", sig))
    top_repeats = [{"n": n, "tool": tool, "text": sig}
                   for (tool, sig), n in sorted(repeats.items(), key=lambda kv: -kv[1])[:15] if n > 1]
    lines += ["", "## 날짜별", ""]
    day = None
    for it in items:
        d = logical_day(it["ts"], cfg).isoformat()
        if d != day:
            day = d
            lines += ["", "### " + d]
        lines.append("- %s [%s]%s %s%s" % (
            it["ts"].astimezone(tz).strftime("%H:%M"), label[it["kind"]],
            " " + it["tool"] if it["tool"] else "", it["text"],
            "  (작업: %s)" % it["task"] if it["task"] else ""))

    out_dir = os.path.join(jdir, "errors")
    os.makedirs(out_dir, exist_ok=True)
    md_path = os.path.join(out_dir, "errors.md")
    json_path = os.path.join(out_dir, "errors.json")
    with open(md_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({"days": days, "generated": now.isoformat(), "counts": counts, "repeats": top_repeats,
                   "items": [dict(it, ts=it["ts"].isoformat()) for it in items]},
                  f, ensure_ascii=False, indent=1)
    return counts, md_path, json_path


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--journal-dir")
    ap.add_argument("--projects-dir", default=os.path.join(os.path.expanduser("~"), ".claude", "projects"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("collect")
    c.add_argument("--date")
    f = sub.add_parser("set-folder")
    f.add_argument("--cwd", required=True)
    f.add_argument("--record", choices=["yes", "no"], required=True)
    f.add_argument("--public", choices=["yes", "no"], default="no")
    f.add_argument("--target", choices=["til", "readme", "both"], default="til")
    sub.add_parser("paths")
    e = sub.add_parser("errors")
    e.add_argument("--days", type=int, default=30)
    u = sub.add_parser("candidates-used")
    u.add_argument("--date")
    a = ap.parse_args(argv)

    jdir = journal_dir(a.journal_dir)
    cfg = load_config(jdir)

    if a.cmd == "paths":
        print("journal_dir=" + ascii(jdir))
        print("config=" + ascii(config_path(jdir)))
        return 0
    if a.cmd == "set-folder":
        cfg["folders"][folder_key(a.cwd)] = {
            "cwd": a.cwd, "record": a.record == "yes",
            "public": a.public == "yes", "target": a.target,
        }
        save_config(jdir, cfg)
        print("saved key=" + ascii(folder_key(a.cwd)))
        return 0
    if a.cmd == "errors":
        counts, md_path, json_path = errors(a.days, cfg, a.projects_dir, jdir)
        print("days=%d %s" % (a.days, " ".join("%s=%d" % kv for kv in sorted(counts.items()))))
        print("errors_md=" + ascii(md_path))
        print("errors_json=" + ascii(json_path))
        return 0

    if a.date:
        day = datetime.strptime(a.date, "%Y-%m-%d").date()
    else:
        day = logical_day(datetime.now(timezone.utc), cfg)
    if a.cmd == "candidates-used":
        print("date=%s marked=%d" % (day.isoformat(), mark_used(day, cfg, jdir)))
        return 0
    meta, md_path, meta_path, size = collect(day, cfg, a.projects_dir, jdir)
    st = [p["status"] for p in meta["projects"]]
    print("date=%s projects=%d new=%d excluded=%d digest_chars=%d" % (
        meta["date"], len(st), st.count("new"), st.count("excluded"), size))
    print("digest=" + ascii(md_path))
    print("meta=" + ascii(meta_path))
    return 0


if __name__ == "__main__":
    sys.exit(main())
