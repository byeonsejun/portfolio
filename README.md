# 변세준 — Frontend Portfolio

프로젝트 5개를 전개형 카드로 펼쳐 놓은 단일 페이지. 정적 사이트이고 서버
런타임이 없다.

- **스택** Next.js 16 App Router · React 19 · TypeScript strict · Tailwind v4
- **배포** `output: "export"` 정적 빌드 → Cloudflare Pages
- **문서형 디자인** 무채색 + 앰버 하나. 위계를 색이 아니라 농도와 여백으로 만든다.

## 개발

```bash
npm install
npm run dev      # predev 가 폰트·이미지 파이프라인을 먼저 돌린다
```

## 빌드

```bash
npm run build    # prebuild(폰트·이미지) → next build → postbuild(폰트 pass 2)
npm run serve    # out/ 을 brotli 로 서빙 (측정용, 8766)
```

## 이 저장소에서 특이한 것

### 이미지 파이프라인 (`scripts/build-images.mjs`)

`public/projects/` 의 원본을 빌드 전에 640/1280/1920 폭의 AVIF·WebP 로 파생한다.
페이지는 파생본만 쓰고 원본은 라이트박스 확대 때만 받아간다. 세로로 긴 모바일
캡처는 16:9 로 상단 크롭해 썸네일을 따로 만들고, GIF 는 mp4 로 바꾼다.

- `public/projects/**` 배포되는 원본 (커밋)
- `media-src/**` 배포되지 않는 빌드 입력 (커밋) — mp4 로 대체될 GIF
- `public/derived/**` 파생본 (gitignore, 재생성)

### 폰트 서브셋 (`scripts/build-fonts.mjs`)

Pretendard 를 이 페이지가 실제로 쓰는 글자만 남겨 자기호스팅한다.
글자 목록은 손으로 적지 않고 **빌드된 HTML 과 번들 JS 에서 뽑는다** — 런타임에
조립되는 문자열은 HTML 에 없기 때문이다.

두 조각으로 나눈다.

| | 내용 | 언제 받나 |
|---|---|---|
| `page` | 지금 이 페이지가 쓰는 글자 | preload, 항상 |
| `reserve` | 안전 여유 (상용 한글 + 기본 기호) | 그 글자가 화면에 나타나야만 |

`unicode-range` 를 서로 겹치지 않게 잘라서, 여유분은 평소에 요청조차 되지
않는다. 같이 넣으면 LCP 요소(히어로의 한글 문장)가 약 440ms 늦는다.

**2-pass 다.** pass 1 은 `font-charset.lock.json` 의 직전 분할로 폰트를 만들고,
`next build` 뒤의 pass 2 가 빌드된 HTML 로 진짜 분할을 계산한다. 둘이 다르면
락파일을 갱신하고 빌드를 세운다 — 이미 만들어진 HTML 이 옛 분할 기준의 콜로폰
실측치와 CSS 해시를 담고 있어서다. 한 번 더 돌리면 고정점에 든다.

> `font-charset.lock.json` 은 커밋한다. `package-lock.json` 과 같은 성격이다 —
> 생성물이지만 빌드 입력이고, 없으면 clone 직후 첫 빌드가 반드시 두 번 돈다.

### 폰트 검증 (`scripts/verify-fonts.mjs`)

```bash
npm run verify:fonts   # 빌드 후 로컬에서 수동 실행
```

헤드리스 Chrome 으로 페이지를 띄우고 렌더러에게 **실제로 어떤 폰트로 그렸는지**
직접 묻는다 (CDP `CSS.getPlatformFontsForNode`). 렌더된 DOM 의 모든 글자를
서브셋 cmap 과 대조하고, reserve 조각이 요청되지 않았는지도 확인한다.

배포 CI 에는 브라우저가 없고 폰트는 문구가 바뀔 때만 영향을 받으므로
`postbuild` 에서 분리했다. 브라우저 없이 되는 검사(cmap 되읽기, `unicode-range`
배타성, fvar 축 보존, 고정점 일치)는 `postbuild` 에 남아 빌드를 세운다.

### 다이어그램

`public/diagrams/` 의 SVG 6개를 빌드 타임에 읽어 **인라인으로** 렌더한다.
`<img>` 로 넣으면 바깥 문서의 테마를 볼 수 없어서, 라이트/다크 토글에 함께
반응하도록 마크업째 박았다.

팔레트에 의미가 있다 — 보라 = 내가 짠 코드 · 틸 = 외부 시스템 · 앰버 = 핵심 성과.

## 데이터 계층

```
src/data/projects.ts               저작 — 경로·alt·caption 만
src/data/generated/*.json          생성 — width·height·파생본·폰트 실측치
src/data/resolve.ts                병합. 매니페스트에 키가 없으면 빌드 실패
```
