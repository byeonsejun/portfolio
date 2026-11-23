# 포트폴리오(sejunb.com) 검색 최적화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** sejunb.com 에 사이트맵 · robots 보강 · 개인 프로필 구조화 데이터 · `llms.txt` · 이름 중심 메타 문구를 넣고, 빌드 결과를 검사하는 스크립트로 확인한다.

**Architecture:** Next 16 정적 export 한 페이지 사이트다. robots · sitemap · llms.txt 는 `src/app` 의 메타데이터 파일 / force-static 라우트로 빌드 때 파일이 된다. 구조화 데이터와 llms.txt 본문은 `src/data/projects.ts`(→ `resolvedProjects`)와 `src/data/site.ts` 에서 만들어 카드와 어긋나지 않게 한다. 테스트 도구가 없는 저장소라, 기존 `verify-fonts.mjs` 처럼 `out/` 을 검사하는 `scripts/verify-seo.mjs` 가 테스트 역할을 한다.

**Tech Stack:** Next.js 16.3.2 (App Router, `output: "export"`), TypeScript, Node 스크립트(.mjs)

**Spec:** `docs/superpowers/specs/2026-11-20-seo-aeo-geo-design.md` (§4.1, §4.7, §5)

## Global Constraints

- 정본 주소는 `SITE_URL` = `https://sejunb.com` (`src/data/site.ts`). 하드코딩 금지, 이 상수만 쓴다.
- JSON-LD 는 서버 렌더 `<script type="application/ld+json">` 으로만, `JSON.stringify(x).replace(/</g, "\\u003c")`. 새 클라이언트 JS 금지.
- 기존 robots 의 `/*.txt$` 차단(RSC `.txt` 중복 색인 방지)은 유지하고 `/llms.txt` 만 허용.
- 이메일은 사이트가 일부러 가려 보여 준다(`ObfuscatedEmail`). 구조화 데이터 · llms.txt 에 이메일을 쓰지 않는다.
- 문구는 사람이 쓴 문체, 화면 내용과 사실이 같게(메모리 `portfolio-docs-voice`). 카드(`projects.ts`) 글은 바꾸지 않는다.
- Next 16 문서는 `node_modules/next/dist/docs/` 를 따른다(AGENTS.md). JSON-LD: `01-app/02-guides/json-ld.md`.
- 빌드 후 폰트 락파일(`font-charset.lock.json`)이 바뀌면 함께 커밋한다(빌드 두 번 → 고정점).
- 커밋 형식: `feat:`/`docs:` + 한국어 제목 + 왜 그렇게 했는지 본문, `Co-Authored-By` 줄. PR 하나, 머지는 소유자가 시킬 때만.

## Review Focus

- **pages.dev 미러:** 같은 HTML 이 `sejunb-portfolio.pages.dev` 에서도 나간다. robots · sitemap · JSON-LD 안의 주소가 모두 `https://sejunb.com` 이어야 한다(호스트에 따라 바뀌면 안 됨) → Task 1 · 2 검사에 포함.
- **404 페이지:** JSON-LD 를 layout 에 두면 `not-found` 에도 프로필이 붙는다. page.tsx 에만 → Task 2 검사(404.html 에 ld+json 없음).
- **데모 링크 없는 프로젝트:** `links.demo` 가 없으면 `links.repo` 로, 둘 다 없으면 `url` 을 빼야 한다(빈 문자열 금지) → Task 2 단위 검사.
- **`</script>` 주입:** 태그라인 등에 `<` 가 들어가도 스크립트가 깨지지 않아야 한다 → Task 2 검사(`<` 치환 확인).
- **RSC `.txt` 재노출:** `/llms.txt` 허용 규칙이 `index.txt` · `__next._full.txt` 를 다시 열면 안 된다 → Task 1 검사.

---

### Task 1: 검사 스크립트 + robots · sitemap

**Files:**
- Create: `scripts/verify-seo.mjs`
- Create: `src/app/sitemap.ts`
- Modify: `src/app/robots.ts`
- Modify: `package.json` (scripts 에 `"verify:seo": "node scripts/verify-seo.mjs"`)

**Interfaces:**
- Produces: `verify-seo.mjs` — `out/` 을 읽어 검사 목록을 돌리고, 실패가 하나라도 있으면 실패 항목을 출력하고 `process.exit(1)`. 이후 Task 들은 이 파일의 검사 배열에 항목을 추가한다(`checks.push({ name, run })` 형태, `run` 은 실패 시 메시지 문자열, 통과 시 `null` 반환).

- [ ] **Step 1: 기준선 측정** — 운영 `https://sejunb.com` Lighthouse 모바일 SEO 점수를 2회 재서 기록(나중에 README · project-data 에 씀).
  Run: `npx -y lighthouse@13.4.1 https://sejunb.com --only-categories=seo --quiet --chrome-flags="--headless=new" --output=json --output-path=$CLAUDE_JOB_DIR/tmp/pf-seo-before.json`

- [ ] **Step 2: 검사 스크립트 작성(실패해야 함)** — 검사 항목:
  - `out/robots.txt` 에 `Allow: /llms.txt` · `Disallow: /*.txt$` · `Sitemap: https://sejunb.com/sitemap.xml` 이 모두 있다.
  - `/llms.txt` 허용이 `index.txt` 를 열지 않는다: robots 에 `Allow: /*.txt` 나 `Allow: /` 뒤 `.txt` 와일드카드 허용이 없다.
  - `out/sitemap.xml` 존재, `<loc>https://sejunb.com/</loc>` 정확히 1개, `pages.dev` 문자열 없음.

- [ ] **Step 3: 실행해 실패 확인**
  Run: `npm run build && npm run verify:seo`
  Expected: FAIL — sitemap.xml 없음, robots 에 Allow/Sitemap 없음

- [ ] **Step 4: 구현** — `sitemap.ts`: `dynamic = "force-static"`, `[{ url: SITE_URL + "/", lastModified: <빌드 시각> }]` 하나. `robots.ts`: rules 는 `{ userAgent: "*", allow: ["/", "/llms.txt"], disallow: "/*.txt$" }`, `sitemap: SITE_URL + "/sitemap.xml"`. 파일 주석의 "sitemap 은 선언하지 않는다" 단락을 "왜 이제 선언하는지(검색 노출을 근거로 남기기로 한 설계, llms.txt 예외)"로 고쳐 쓴다. host 를 쓰지 않는 이유 단락은 유지.

- [ ] **Step 5: 통과 확인**
  Run: `npm run build && npm run verify:seo`
  Expected: PASS (모든 검사 통과 출력, 종료 코드 0)

- [ ] **Step 6: 커밋** — `feat: 사이트맵을 만들고 robots 에서 llms.txt 만 열어 둠`

### Task 2: 개인 프로필 구조화 데이터

**Files:**
- Create: `src/data/structured-data.ts`
- Modify: `src/app/page.tsx` (JSON-LD `<script>` 렌더)
- Modify: `scripts/verify-seo.mjs` (검사 추가)

**Interfaces:**
- Consumes: `resolvedProjects` (`@/data/resolve`), `SITE_URL` · `GITHUB_HREF` (`@/data/site`)
- Produces: `buildProfileJsonLd(projects: readonly ResolvedProject[]): Record<string, unknown>` · `toJsonLdScript(data: unknown): string` (stringify + `<` → `<`). Task 3 은 `projectUrl(p: ResolvedProject): string | undefined` 를 재사용한다(demo → repo → undefined).

- [ ] **Step 1: 검사 추가(실패해야 함)** — `out/index.html` 의 `application/ld+json` 을 파싱해:
  - `@type` 이 `ProfilePage`, `mainEntity.@type` 이 `Person`, `mainEntity.name` 이 `"변세준"`, `alternateName` 이 `"BYUN SEJUN"`, `jobTitle` 이 `"프론트엔드 개발자"`, `url` 이 `"https://sejunb.com/"`, `sameAs` 에 `"https://github.com/byeonsejun"` 포함.
  - `mainEntity.subjectOf`(또는 `hasPart`) 의 `ItemList.itemListElement` 길이 = 6, 각 항목 `item.name` 이 카드 이름과 같고 `item.url` 이 비어 있지 않음(있을 때만 키 존재).
  - JSON 안에 `@` 이메일 주소 없음, `pages.dev` 없음, 원문 `<` 없음.
  - `out/404.html` 에는 `application/ld+json` 없음.

- [ ] **Step 2: 실행해 실패 확인**
  Run: `npm run build && npm run verify:seo`
  Expected: FAIL — index.html 에 ld+json 없음

- [ ] **Step 3: 구현** — 모양: `ProfilePage{ url, name: "변세준 — 프론트엔드 개발자 포트폴리오", mainEntity: Person{ name, alternateName, jobTitle, url, sameAs: [GITHUB_HREF], knowsAbout: <카드 techStack 이름 중 상위 몇 개, 중복 제거> }, hasPart: ItemList{ itemListElement: ListItem{ position, item: CreativeWork{ name, description: tagline, url?: projectUrl(p), sameAs?: repo(데모와 다를 때) } } } }`. 렌더는 `page.tsx` 의 반환 맨 앞 `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: toJsonLdScript(...) }} />`.

- [ ] **Step 4: 통과 확인**
  Run: `npm run build && npm run verify:seo`
  Expected: PASS

- [ ] **Step 5: 외부 검증** — 빌드 결과를 로컬로 띄워(`npm run serve`) JSON-LD 를 https://validator.schema.org 에 붙여 넣어 오류 0 확인, 결과를 메모해 둔다(Task 4 문서용).

- [ ] **Step 6: 커밋** — `feat: 포트폴리오에 개인 프로필과 프로젝트 목록 구조화 데이터를 넣음`

### Task 3: llms.txt

**Files:**
- Create: `src/app/llms.txt/route.ts`
- Modify: `scripts/verify-seo.mjs`

**Interfaces:**
- Consumes: `resolvedProjects`, `projectUrl` (Task 2), `SITE_URL`, `GITHUB_HREF`
- Produces: `out/llms.txt` (text/plain, UTF-8)

- [ ] **Step 1: 검사 추가(실패해야 함)** — `out/llms.txt` 존재, 첫 줄 `# 변세준 — 프론트엔드 개발자 포트폴리오`, `https://sejunb.com` 과 `https://github.com/byeonsejun` 포함, 6개 프로젝트 이름이 모두 `## ` 제목으로 있고 각 제목 아래에 그 프로젝트의 `projectUrl` 이 있음(있을 때), 이메일 없음.

- [ ] **Step 2: 실행해 실패 확인** — `npm run build && npm run verify:seo` → FAIL (llms.txt 없음)

- [ ] **Step 3: 구현** — `export const dynamic = "force-static"`, `GET()` 이 `text/plain; charset=utf-8` 응답. 본문(llmstxt.org 형식): 제목 줄 → `> ` 한 줄 요약(누구, 무엇을 하는 개발자인지: Hero 문장과 같은 사실) → 포트폴리오 · GitHub 링크 → 프로젝트마다 `## 이름` + 태그라인 + 역할(`role`, 있으면) + 링크. 수치를 새로 만들지 말고 카드에 있는 값만.

- [ ] **Step 4: 통과 확인** — `npm run build && npm run verify:seo` → PASS. `curl -s http://127.0.0.1:8766/llms.txt | head` 로 한글이 깨지지 않는지 확인(`npm run serve` 상태).

- [ ] **Step 5: 커밋** — `feat: AI 검색이 읽을 llms.txt 를 프로젝트 데이터에서 만듦`

### Task 4: 이름 중심 메타 문구 · 측정 · 문서

**Files:**
- Modify: `src/app/layout.tsx` (title · description · OG · twitter 문구)
- Modify: `scripts/verify-seo.mjs`
- Modify: `README.md` ("검색 노출" 절 추가), `docs/project-data.md`(포트폴리오 자체 절이 없으면 맨 아래 "포트폴리오 사이트" 절)
- Modify (빌드 결과에 따라): `font-charset.lock.json`

- [ ] **Step 1: 검사 추가(실패해야 함)** — `out/index.html` 의 `<title>` 이 `변세준 | 프론트엔드 개발자 포트폴리오`, `meta[name=description]` 이 `변세준`·`프론트엔드` 로 시작하는 문장이고 80자 이상 160자 이하, `og:title` · `twitter:title` 이 title 과 같음, `link[rel=canonical]` = `https://sejunb.com/`.

- [ ] **Step 2: 실패 확인** — `npm run build && npm run verify:seo` → FAIL (title 다름)

- [ ] **Step 3: 구현** — title `변세준 | 프론트엔드 개발자 포트폴리오`. description(정확한 문구):
  `프론트엔드 개발자 변세준의 포트폴리오입니다. 실서비스로 운영 중인 일본 복권 명당 지도, 3D 가구 쇼핑몰, 실시간 고속도로 관제 화면 등 6개 프로젝트를 문제와 판단, 실측 결과로 정리했습니다.`
  `openGraph.siteName` 은 `변세준 포트폴리오`. OG 이미지 · alt 는 그대로.

- [ ] **Step 4: 통과 확인 + 폰트 락** — `npm run build && npm run build && npm run verify:seo && npm run verify:fonts` → 모두 PASS. `git status` 에 `font-charset.lock.json` 이 바뀌었으면 함께 커밋 대상.

- [ ] **Step 5: 로컬 Lighthouse** — `npm run serve` 상태에서 `npx -y lighthouse@13.4.1 http://127.0.0.1:8766/ --only-categories=seo --quiet --chrome-flags="--headless=new"` 2회. 기대: SEO 100, 실패 감사 없음.

- [ ] **Step 6: 문서** — README 에 "검색 노출" 절(3~6줄, 사람 문체): 무엇을 넣었는지(사이트맵 · 프로필 구조화 데이터 · llms.txt), robots 에서 `.txt` 는 막고 `llms.txt` 만 연 이유, 이메일을 구조화 데이터에 넣지 않은 이유. `docs/project-data.md` 에 Step 1(Task 1) 기준선 점수와 Step 5 결과, schema 검증 결과를 날짜와 함께.

- [ ] **Step 7: 커밋** — `feat: 검색 결과에 이름과 직무가 먼저 보이도록 메타 문구를 고침` (+ 문서 · 락파일)

- [ ] **Step 8: PR** — 브랜치 `feat/seo-aeo-geo`(설계 문서 커밋이 이미 있음) push, PR 제목 `feat: 포트폴리오 검색 노출을 정리함(사이트맵 · 구조화 데이터 · llms.txt)`, 본문에 왜 · 무엇 · 검증(verify:seo · Lighthouse 전후 · schema 검증). 머지는 소유자 지시 후. 머지 후 운영에서 `robots.txt` · `sitemap.xml` · `llms.txt` 200 과 JSON-LD 확인.

### Task 5: 소유자 안내 — 서치 콘솔 · 네이버 등록

코드 변경 없음. 머지 · 배포 확인 뒤 소유자에게 `sejunb.com` 등록 절차를 화면 단위로 안내하고, 받은 확인 코드(구글 HTML 파일 또는 메타, 네이버 메타)를 별도 PR 로 넣는다. 사이트맵 제출 주소 `https://sejunb.com/sitemap.xml`.
