"""plog.py 단위 테스트. 각 테스트 이름은 SKILL.md 규칙표의 Test 열과 같다."""
import json
import os
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "scripts"))
import plog  # noqa: E402

CFG = {"day_start": "05:30", "tz_offset_hours": 9, "folders": {}}


def line(ts, typ, content, cwd="C:\\Work\\Proj", sid="s1", **extra):
    o = {"type": typ, "timestamp": ts, "sessionId": sid, "cwd": cwd,
         "message": {"role": typ, "content": content}}
    o.update(extra)
    return json.dumps(o, ensure_ascii=False)


class PlogTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.projects = os.path.join(self.tmp.name, "projects")
        self.journal = os.path.join(self.tmp.name, "journal")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, slug, name, lines):
        d = os.path.join(self.projects, slug)
        os.makedirs(d, exist_ok=True)
        with open(os.path.join(d, name), "w", encoding="utf-8") as f:
            f.write("\n".join(lines) + "\n")

    def run_collect(self, day, cfg=None):
        cfg = cfg or json.loads(json.dumps(CFG))
        return plog.collect(day, cfg, self.projects, self.journal)

    def read_digest(self, day):
        with open(os.path.join(self.journal, "digest", day.isoformat() + ".digest.md"), encoding="utf-8") as f:
            return f.read()

    # PL-1
    def test_window_after_midnight(self):
        # KST 10-12 02:00 = UTC 10-11 17:00 -> 논리적 날짜는 10-11
        now = datetime(2026, 10, 11, 17, 0, tzinfo=timezone.utc)
        self.assertEqual(plog.logical_day(now, CFG), date(2026, 10, 11))
        # KST 10-12 05:30 = UTC 10-11 20:30 -> 10-12
        now = datetime(2026, 10, 11, 20, 30, tzinfo=timezone.utc)
        self.assertEqual(plog.logical_day(now, CFG), date(2026, 10, 12))

    # PL-2
    def test_utc_conversion(self):
        start, end = plog.window(date(2026, 10, 11), CFG)
        self.assertEqual(start.astimezone(timezone.utc).isoformat(), "2026-10-10T20:30:00+00:00")
        self.assertEqual(end.astimezone(timezone.utc).isoformat(), "2026-10-11T20:30:00+00:00")
        self.write("slug", "a.jsonl", [
            line("2026-10-10T20:29:59Z", "user", "전날 질문"),
            line("2026-10-10T23:49:00Z", "user", "오늘 아침 질문"),
            line("2026-10-11T19:00:00Z", "user", "새벽 4시 질문"),
            line("2026-10-11T20:30:00Z", "user", "다음날 질문"),
        ])
        self.run_collect(date(2026, 10, 11))
        d = self.read_digest(date(2026, 10, 11))
        self.assertIn("오늘 아침 질문", d)
        self.assertIn("새벽 4시 질문", d)
        self.assertNotIn("전날 질문", d)
        self.assertNotIn("다음날 질문", d)

    # PL-3
    def test_sidechain_excluded(self):
        self.write("slug", "a.jsonl", [
            line("2026-10-11T01:00:00Z", "user", "메인 질문"),
            line("2026-10-11T01:01:00Z", "user", "사이드체인 질문", isSidechain=True),
        ])
        sub = os.path.join(self.projects, "slug", "s1", "subagents")
        os.makedirs(sub)
        with open(os.path.join(sub, "agent-x.jsonl"), "w", encoding="utf-8") as f:
            f.write(line("2026-10-11T01:02:00Z", "user", "서브에이전트 질문") + "\n")
        self.run_collect(date(2026, 10, 11))
        d = self.read_digest(date(2026, 10, 11))
        self.assertIn("메인 질문", d)
        self.assertNotIn("사이드체인 질문", d)
        self.assertNotIn("서브에이전트 질문", d)

    # PL-4
    def test_cwd_merge(self):
        self.write("C--Work-Proj", "a.jsonl", [line("2026-10-11T01:00:00Z", "user", "첫 세션", cwd="C:\\Work\\Proj", sid="s1")])
        self.write("c--Work-Proj", "b.jsonl", [line("2026-10-11T02:00:00Z", "user", "둘째 세션", cwd="c:\\Work\\Proj", sid="s2")])
        meta, _, _, _ = self.run_collect(date(2026, 10, 11))
        self.assertEqual(len(meta["projects"]), 1)
        self.assertEqual(meta["projects"][0]["sessions"], 2)

    # PL-5
    def test_no_timestamp_ignored(self):
        self.write("slug", "a.jsonl", [
            json.dumps({"type": "user", "sessionId": "s1", "cwd": "C:\\W", "message": {"role": "user", "content": "시각 없음"}}),
            "not json",
            line("2026-10-11T01:00:00Z", "user", "시각 있음"),
        ])
        self.run_collect(date(2026, 10, 11))
        d = self.read_digest(date(2026, 10, 11))
        self.assertIn("시각 있음", d)
        self.assertNotIn("시각 없음", d)

    # PL-6
    def test_turn_extraction(self):
        self.write("slug", "a.jsonl", [
            line("2026-10-11T01:00:00Z", "user", "<system-reminder>숨김</system-reminder>진짜 질문"),
            line("2026-10-11T01:00:01Z", "assistant", [
                {"type": "thinking", "thinking": "내부 추론"},
                {"type": "text", "text": "중간 답변"},
                {"type": "tool_use", "name": "Write", "input": {"file_path": "C:\\Work\\Proj\\a.py"}},
            ]),
            line("2026-10-11T01:00:02Z", "user", [{"type": "tool_result", "content": "도구 출력"}]),
            line("2026-10-11T01:00:03Z", "assistant", [{"type": "text", "text": "최종 답변"}]),
            line("2026-10-11T01:00:04Z", "user", "스킬 주입 본문", isMeta=True),
            line("2026-10-11T01:00:05Z", "user", "<task-notification>알림</task-notification>"),
            line("2026-10-11T01:00:06Z", "user", "<command-name>/portfolio-log</command-name><command-args>어제</command-args>"),
        ])
        meta, _, _, _ = self.run_collect(date(2026, 10, 11))
        d = self.read_digest(date(2026, 10, 11))
        self.assertIn("진짜 질문", d)
        self.assertNotIn("숨김", d)
        self.assertNotIn("내부 추론", d)
        self.assertNotIn("중간 답변", d)
        self.assertIn("최종 답변", d)
        self.assertNotIn("도구 출력", d)
        self.assertNotIn("스킬 주입 본문", d)
        self.assertNotIn("알림", d)
        self.assertIn("[명령] /portfolio-log 어제", d)
        self.assertEqual(meta["projects"][0]["files"], ["C:\\Work\\Proj\\a.py"])

    # PL-7
    def test_masking(self):
        self.write("slug", "a.jsonl", [
            line("2026-10-11T01:00:00Z", "user", "키는 sk-ant-abcdefghijklmnopqrstuvwx 이고 api_key=supersecret123 이다"),
            line("2026-10-11T01:00:01Z", "user", "https://discord.com/api/webhooks/123456789/FAKE_token_for_test 로 보내"),
        ])
        self.run_collect(date(2026, 10, 11))
        d = self.read_digest(date(2026, 10, 11))
        self.assertNotIn("FAKE_token_for_test", d)
        self.assertNotIn("abcdefghijklmnop", d)
        self.assertNotIn("supersecret123", d)
        self.assertIn("api_key=[MASKED]", d)

    # PL-8
    def test_excluded_folder(self):
        self.write("slug", "a.jsonl", [
            line("2026-10-11T01:00:00Z", "user", "비공개 자소서 내용", cwd="C:\\Private"),
            line("2026-10-11T01:00:00Z", "user", "공부 내용", cwd="C:\\Study", sid="s2"),
        ])
        plog.main(["--journal-dir", self.journal, "set-folder", "--cwd", "c:/private", "--record", "no"])
        cfg = plog.load_config(self.journal)
        meta, _, _, _ = self.run_collect(date(2026, 10, 11), cfg)
        d = self.read_digest(date(2026, 10, 11))
        self.assertNotIn("비공개 자소서 내용", d)
        self.assertIn("공부 내용", d)
        status = {p["key"]: p["status"] for p in meta["projects"]}
        self.assertEqual(status, {"c:/private": "excluded", "c:/study": "new"})

    # PL-18
    def test_candidates_in_digest(self):
        self.write("slug", "a.jsonl", [line("2026-10-11T01:00:00Z", "user", "오늘 작업")])
        os.makedirs(self.journal, exist_ok=True)
        with open(os.path.join(self.journal, "candidates.json"), "w", encoding="utf-8") as f:
            json.dump([
                {"id": "s1", "at": "2026-10-11T02:00:00.000Z", "session": "abcdefgh-1", "cwd": "C:/w/proj",
                 "task": "패널", "title": "탭 통합", "intent": "단순화", "problem": "같은 정보 token=abcdef1234",
                 "outcome": "합침", "why": "설계 결정", "evidence": ""},
                {"at": "2026-10-11T03:00:00+00:00", "kind": "tool_error", "text": "예전 형식 후보", "task": ""},
                {"id": "s2", "at": "2026-10-12T02:00:00+00:00", "title": "다른 날 후보"},
            ], f, ensure_ascii=False)
        self.run_collect(date(2026, 10, 11))
        d = self.read_digest(date(2026, 10, 11))
        self.assertIn("## 기록 후보 (현황판에서 고름)", d)
        self.assertIn("- **탭 통합** (11:00, proj, 세션 abcdefgh)", d)
        self.assertIn("  - 문제: 같은 정보", d)
        self.assertNotIn("근거:", d)
        self.assertIn("예전 형식 후보", d)
        self.assertNotIn("abcdef1234", d)
        self.assertNotIn("다른 날 후보", d)

    # PL-19
    def test_candidates_used_after_save(self):
        self.write("slug", "a.jsonl", [line("2026-10-11T01:00:00Z", "user", "오늘 작업")])
        os.makedirs(self.journal, exist_ok=True)
        with open(os.path.join(self.journal, "candidates.json"), "w", encoding="utf-8") as f:
            json.dump([{"id": "s1", "at": "2026-10-11T02:00:00Z", "title": "쓴 후보"},
                       {"id": "s2", "at": "2026-10-12T02:00:00Z", "title": "다른 날"}], f, ensure_ascii=False)
        plog.main(["--journal-dir", self.journal, "candidates-used", "--date", "2026-10-11"])
        with open(os.path.join(self.journal, "candidates-used.json"), encoding="utf-8") as f:
            self.assertEqual(json.load(f), ["s1"])
        self.run_collect(date(2026, 10, 11))
        self.assertNotIn("쓴 후보", self.read_digest(date(2026, 10, 11)))

    # PL-17
    def test_errors_extraction(self):
        self.write("slug", "a.jsonl", [
            line("2026-10-11T01:00:00Z", "user", "블로그 빌드해줘"),
            line("2026-10-11T01:00:01Z", "assistant", [{"type": "tool_use", "id": "t1", "name": "Bash", "input": {}}]),
            line("2026-10-11T01:00:02Z", "user", [{"type": "tool_result", "tool_use_id": "t1", "is_error": True,
                                                   "content": "Exit code 1\nnpm ERR! 3 failed\n셋째 줄"}]),
            line("2026-10-11T01:00:02Z", "user", [{"type": "tool_result", "tool_use_id": "t1", "is_error": True,
                                                   "content": "The user doesn't want to proceed with this tool use."}]),
            line("2026-10-11T01:00:02Z", "user", "C:\\Downloads\\client_secret_9222-abc.apps.json 이 파일 읽어"),
            line("2026-10-11T01:00:02Z", "user", "You annotate a codebase. " + "x" * 300 + " 잘못 표기된 것은 무시"),
            line("2026-10-11T01:00:03Z", "assistant", [{"type": "tool_use", "id": "t2", "name": "Write", "input": {}}]),
            line("2026-10-11T01:00:04Z", "user", [{"type": "tool_result", "tool_use_id": "t2", "is_error": True,
                                                   "content": "Permission for this action was denied"}]),
            line("2026-10-11T01:00:05Z", "user", [{"type": "tool_result", "tool_use_id": "t1", "content": "ok"}]),
            line("2026-10-11T01:00:06Z", "user", "[Request interrupted by user]"),
            line("2026-10-11T01:00:07Z", "user", "아니 그게 아니라 token=abcdef1234 로 다시"),
            line("2026-10-11T01:00:08Z", "user", "에러 사항을 찾아주라"),
            line("2026-10-11T01:00:09Z", "user", "숨은 지적 아니", isSidechain=True),
            line("2026-10-11T01:00:10Z", "user", "아니 비공개", cwd="C:\\Private", sid="s2"),
            line("2026-09-01T01:00:00Z", "user", "아니 오래된 지적"),
        ])
        plog.main(["--journal-dir", self.journal, "set-folder", "--cwd", "c:/private", "--record", "no"])
        cfg = plog.load_config(self.journal)
        now = datetime(2026, 10, 12, 0, 0, tzinfo=timezone.utc)
        counts, md_path, json_path = plog.errors(30, cfg, self.projects, self.journal, now)
        self.assertEqual(counts, {"tool_error": 1, "rejected": 1, "blocked": 1, "interrupted": 1, "correction": 1})
        with open(json_path, encoding="utf-8") as f:
            items = json.load(f)["items"]
        err = items[0]
        self.assertEqual((err["kind"], err["tool"], err["text"]), ("tool_error", "Bash", "Exit code 1: npm ERR! 3 failed"))
        self.assertEqual(err["task"], "블로그 빌드해줘")
        self.assertEqual(items[1]["kind"], "rejected")
        blocked = [it for it in items if it["kind"] == "blocked"][0]
        self.assertEqual(blocked["tool"], "Write")
        self.assertNotIn("9222", json.dumps(items, ensure_ascii=False))
        corr = [it for it in items if it["kind"] == "correction"][0]
        self.assertNotIn("abcdef1234", corr["text"])
        with open(md_path, encoding="utf-8") as f:
            md = f.read()
        self.assertNotIn("숨은 지적", md)
        self.assertNotIn("비공개", md)
        self.assertNotIn("오래된 지적", md)


if __name__ == "__main__":
    unittest.main()
