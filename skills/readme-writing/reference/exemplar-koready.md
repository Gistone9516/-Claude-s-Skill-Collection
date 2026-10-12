# Exemplar: koready-backend README (chosen by the user, 2026-10-12)

Source: https://github.com/ppp1969/koready-backend (README.md as fetched 2026-10-12).
The user's words: "koready 이게 가장 괜찮네. 여기에 기술적인 면이 더 추가되어도 어색하지 않을 듯. 이걸 기반으로 다른 repo의 호환되는 장점을 흡수."

The repo declares no license, so its body is not copied here; this file holds its outline, its features, a few short quotes, and the patterns absorbed from other repos. Open the source for the full text when drafting.

## Outline, in order

| Section | What it holds |
|---|---|
| `# KoReady Backend` | name only |
| first sentence | who it is for and what it does, in one sentence |
| screenshot row | four images in one `<p align="center">`, each `width="24%"` with Korean alt text |
| link row | 서비스 바로가기 · API 계약 · 개발·운영 가이드 |
| scope paragraph | how the service differs, then what this repo (the backend) is responsible for |
| `## 담당 역할` | five noun-ending bullets of what the author built, then one sentence on what the admin console is for |
| `## 서비스 구조` | one mermaid flowchart, then two paragraphs: the design choice and why, then the problem the choice created and how it was handled |
| `## 주요 문제 해결` | five numbered `###` items, each in the same three beats (below) |
| `## 검증 결과` | the commit the results were taken at, then a table 검증 / 결과 / 근거 with a CI run link per row |
| `## 기술 스택` | table 영역 / 기술 |
| `## 주요 기능` | six bullets, placed late on purpose |
| `## 실행과 문서` | three commands with a one-line comment each, then links into `docs/` |
| `## 프로젝트 상태` | one paragraph: goal, stage, what each environment is for |

`<br>` separates sections. No badges, no emoji, no table of contents (GitHub builds one from the headings).

## Features (what to imitate)

**Layout**
- The first screen answers what it is, what it looks like, and where to go next, before any heading.
- Problem solving comes before features. Features are a short list near the end; the reader has already understood the product from the screenshots.
- Detail that is not needed to judge the work (local setup, policies, design docs) lives in `docs/` and is reached by link.

**Flow**
- A decision is written with its cost. 서비스 구조: "원본을 내부 DB에 저장한 뒤 사용자에게 보여줄 데이터를 준비하는 방식을 선택했습니다." then "대신 이 선택으로 외부 원본과 내부 데이터가 달라질 수 있다는 새로운 문제가 생겼습니다."
- Each 문제 해결 item has three beats: a paragraph on why it is a problem (the failure it would cause), a bold **주요 변경 사항** label over noun-ending bullets, and one closing sentence on the result. Example opening: "외부 API가 빈 배열을 반환했다고 해서 실제 관광지가 모두 사라진 것은 아닙니다."
- Claims carry evidence the reader can click: a pinned commit and a CI run per row.

**Wording**
- Body in 합니다체, plain and concrete. Bullets end in nouns: "~ 방지", "~ 구성", "~ 분리".
- Technical terms stay in their own form and in code style: `FOR UPDATE SKIP LOCKED`, fingerprint, lease, worker.
- Numbers are stated as measured (699개 통과, 84.49%) without adjectives around them.

**Selection**
- What the author did is separated from what the service does (담당 역할 vs 주요 기능).
- Nothing is padded: 프로젝트 상태 is one paragraph, the admin console gets one sentence.

## Absorbed from other repos (compatible with the above)

| From | Pattern | How it fits |
|---|---|---|
| [Threadia](https://github.com/SEUIL/Threadia) | Each 문제 해결 item keeps its visible summary; the technical depth (timeline, before/after diagram, measurements, related code) sits in a `<details>` whose summary names what is inside, e.g. "리뷰 5라운드 타임라인 · Before/After 다이어그램 · 정량 지표" | This is where "기술적인 면" is added without lengthening the first read. Drop its "📖 ▶ 펼쳐서 보기" decoration; the content list is the useful part |
| [OMG](https://github.com/OnNaNOn/OMG) | The fold for a decision holds the alternatives considered and why one was chosen (synchronized, Redis, optimistic lock, pessimistic lock ✅), then the observed result | Outside: the result. Inside: the path to it. Drop its emoji headings |
| Threadia | Large diagrams that are not the main story (past deployment architecture, ERDs) fold | Keeps the first screen short |
| [uv](https://github.com/astral-sh/uv), [vite](https://github.com/vitejs/vite) | `<picture>` with a `prefers-color-scheme: dark` source for a logo or image diagram | Only when an image would be unreadable in one theme |
| [neovim](https://github.com/neovim/neovim), [ripgrep](https://github.com/BurntSushi/ripgrep) | Long material split into `BUILD.md`, `docs/`, sub-folder READMEs instead of folded | When a fold would be longer than about a screen |

Fold skeleton, written for this skill (not copied):

```html
<details>
<summary>검토한 대안 · 부하 테스트 결과 · 관련 코드</summary>

(blank line above is required, or the markdown inside renders raw)

...

</details>
```
