import type { Project } from "@/types/project";

/**
 * works 섹션 저작 데이터.
 *
 * 여기에는 "어떤 파일인지 + 편집자만 아는 정보"만 쓴다.
 * width·height·파생본·poster 처럼 파일에서 파생되는 값은 이미지 매니페스트가
 * 갖고 있고 src/data/resolve.ts 가 병합한다.
 *
 * metrics / troubleshooting 은 docs/project-data.md 를 옮긴 것이다.
 * 수치와 문장은 원문 그대로다.
 */
export const projects: readonly Project[] = [
  {
    slug: "travel-agency",
    name: "Nextour",
    tagline: "AI가 찾아주는 맞춤형 패키지 여행 예약 플랫폼",
    order: 1,
    cover: {
      src: "/projects/travel-agency/home.png",
      alt: "Nextour 홈 화면",
    },
    metrics: [
      {
        label: "ADR",
        value: "62건",
        kind: "measured",
        note: "0001–0062, 결번 없음",
      },
      {
        label: "결제",
        value: "2-phase",
        kind: "structural",
        note: "좌석 선점 → PG 승인 → DB 확정",
      },
      {
        label: "환불",
        value: "3-phase saga",
        kind: "structural",
        note: "외부 IO를 DB 트랜잭션 밖으로 격리",
      },
      {
        label: "멱등성",
        value: "3중",
        kind: "structural",
        note: "Idempotency-Key · RefundJob 게이트 · providerEventId",
      },
      {
        label: "아키텍처",
        value: "FSD 5-레이어",
        kind: "structural",
        note: "app · widgets 13 · features 20 · entities 10 · shared",
      },
      {
        label: "테스트",
        value: "1,417건",
        kind: "measured",
        note: "176개 파일 · 2026.10 기준",
      },
      {
        label: "성능 계측",
        value: "자체 RUM",
        kind: "structural",
        note: "Web Vitals p75 · PostgreSQL percentile_cont",
      },
    ],
    screens: [
      {
        kind: "image",
        src: "/projects/travel-agency/search.png",
        alt: "‘온천’ 검색 결과",
        caption: "검색 결과 — 하이브리드 랭킹 · 조건 좁히기 칩",
      },
      {
        kind: "image",
        src: "/projects/travel-agency/pdp.png",
        alt: "상품 상세(PDP)",
        caption: "상품 상세(PDP) — AI 추천 포인트 · 기준 가격",
      },
      {
        kind: "image",
        src: "/projects/travel-agency/checkout.png",
        alt: "체크아웃 예약 정보 입력 화면",
        caption: "체크아웃 — 출발일·잔여 좌석 확인 · 인원/여행자 정보 입력",
      },
      {
        kind: "image",
        src: "/projects/travel-agency/admin-dashboard.png",
        alt: "관리자 대시보드",
        caption: "관리자 대시보드 — 순매출·취소율·좌석 점유율 · Web Vitals p75",
      },
    ],
    diagrams: [
      {
        title: "NEXTOUR FSD 5-레이어 단방향 의존성",
        src: "/diagrams/nextour-fsd.svg",
        description:
          "상위 레이어만 하위 레이어를 import 한다(역방향·동일 레이어 cross-slice import 금지). 강제 수단은 barrel index.ts 공개 API 컨벤션과 ESLint 규칙이다. 외부 import 는 항상 @/entities/{name} 형태의 barrel 경로만 사용한다.",
      },
      {
        title: "NEXTOUR 3-Phase 환불 saga",
        src: "/diagrams/nextour-saga.svg",
        description:
          "환불은 우리 DB 와 Toss PG 에 걸친 분산 트랜잭션이다. 외부 IO(Phase 2)를 DB Tx 밖으로 격리해 락 윈도우를 마이크로초로 줄이고, PG 실패는 RefundJob = PENDING 으로 적재해 cron worker 가 자가 치유한다. 3중 멱등성으로 이중 환불을 차단한다.",
      },
    ],
    troubleshooting: {
      title: "외부 PG 호출을 DB 트랜잭션 밖으로",
      situation:
        "환불은 자사 DB와 외부 PG(토스)에 걸친 분산 트랜잭션입니다. PG 호출과 DB 갱신이 한 트랜잭션 안에 있으면, PG는 성공했는데 DB 커밋이 실패하는 순간 고객 돈은 나갔지만 시스템은 환불을 모르는 상태가 됩니다.",
      cause:
        "외부 네트워크 호출이 트랜잭션 안에 있으면 두 가지가 동시에 문제가 됩니다. PG 응답을 기다리는 수 초 동안 DB 락이 유지되고, 실패 지점에 따라 결과가 갈립니다.",
      solution:
        "Phase를 셋으로 쪼갰습니다. Phase 1(DB Tx)에서 멱등 게이트를 통과시키고 원장을 조건부 차감해 예약합니다. Phase 2는 트랜잭션 밖에서 PG를 호출합니다. Phase 3(DB Tx)에서 정산하고 이벤트를 적재합니다. PG 호출이 실패하면 RefundJob을 PENDING으로 적재하고 지수 백오프로 cron worker가 재시도합니다. 그동안에도 예약 상태는 무결성을 유지합니다.",
      outcome:
        "락 윈도우가 마이크로초 단위로 줄었고, PG 실패가 데이터 불일치로 이어지지 않습니다. 3중 멱등성으로 이중 환불도 차단됩니다. (ADR-0003)",
    },
    techStack: [
      { name: "Next.js 16 (App Router)", category: "framework" },
      { name: "TypeScript", category: "language" },
      { name: "PostgreSQL + pgvector", category: "data" },
      { name: "Prisma ORM", category: "data" },
      { name: "Anthropic Claude API", category: "data" },
      { name: "Auth.js v5", category: "auth" },
      { name: "토스페이먼츠", category: "infra" },
      { name: "Vercel", category: "infra" },
    ],
    links: {
      demo: "https://travel-agency-sooty-mu.vercel.app",
      repo: "https://github.com/byeonsejun/travel_agency",
    },
  },

  {
    slug: "junsgram",
    name: "Junsgram",
    tagline:
      "레거시 Next.js 13 코드베이스를 Next.js 16 / React 19 / Auth.js v5로 전면 현대화한 사진 공유 앱",
    order: 2,
    cover: {
      src: "/projects/junsgram/feed.png",
      alt: "Junsgram 피드 화면",
    },
    metrics: [
      {
        label: "Next.js",
        value: "16",
        baseline: "13.5",
        kind: "measured",
        tone: "positive",
        note: "App Router · Turbopack",
      },
      {
        label: "React",
        value: "19",
        baseline: "18",
        kind: "measured",
        tone: "positive",
      },
      {
        label: "인증",
        value: "Auth.js v5",
        baseline: "NextAuth v4",
        kind: "measured",
        tone: "positive",
      },
      { label: "단위 테스트", value: "20건", kind: "measured", note: "Vitest" },
      { label: "E2E", value: "5건", kind: "measured", note: "Playwright" },
      {
        label: "CI",
        value: "전 PR 게이팅",
        kind: "structural",
        note: "lint · typecheck · test · build",
      },
    ],
    screens: [
      {
        kind: "image",
        src: "/projects/junsgram/signin.png",
        alt: "로그인 화면",
        caption: "로그인",
      },
      {
        kind: "image",
        src: "/projects/junsgram/profile.png",
        alt: "프로필 화면",
        caption: "프로필",
      },
    ],
    diagrams: [
      {
        title: "Junsgram 신뢰 경계 아키텍처",
        src: "/diagrams/junsgram-boundary.svg",
      },
    ],
    troubleshooting: {
      title: "로그인할 때마다 유저가 중복 생성되던 버그",
      situation:
        "Auth.js v5로 마이그레이션하던 중, Sanity에 유저 문서가 계속 늘어나는 것을 발견했습니다.",
      cause:
        "앱이 Sanity 유저 문서의 키로 user.id를 쓰고 있었습니다. 그런데 이 값은 세션마다 새로 생성되는 랜덤 UUID였습니다. 같은 사람이 로그인해도 매번 다른 키가 나오니, 조회에 실패하고 새 문서를 만들었습니다.",
      solution:
        "로그인 방식이 같으면 변하지 않는 Google providerAccountId로 키를 교체했습니다.",
      outcome:
        "중복 생성이 멈췄습니다. 이 버그는 마이그레이션 때문에 생긴 게 아니라 원래 있던 문제였고, 전환 과정에서 인증 흐름을 다시 읽다가 드러났습니다.",
    },
    techStack: [
      { name: "Next.js 16", category: "framework" },
      { name: "React 19", category: "framework" },
      { name: "TypeScript (strict)", category: "language" },
      { name: "Auth.js v5", category: "auth" },
      { name: "Vercel", category: "infra" },
    ],
    links: {
      demo: "https://junsgram.vercel.app",
      /*
       * 임시로 숨김 (복구하려면 이 필드만 지우면 된다).
       *
       * 루트(/)가 Google 로그인으로 막혀 있고, 로그인을 통과해도 피드가 비어 있다 —
       * 검색에서 계정을 찾아 팔로우해야 게시물이 보인다. 즉 장벽이 2단이라
       * 눌러서 앱을 보기까지 4~5단계가 걸린다.
       *
       * 나머지 네 프로젝트는 누르면 곧바로 앱이 뜬다. 그 사이에서 하나만 로그인 벽이면
       * "열어도 못 보는 데모" 가 되는데, 그건 링크가 없는 것보다 나쁘다 —
       * 카드에는 이미 스크린샷과 화면 녹화가 있어 무엇을 만들었는지는 전달된다.
       *
       * 레포에 비로그인 열람 경로(읽기 전용)를 만든 뒤 이 필드를 지워 링크를 복구한다.
       */
      demoHiddenReason: "루트가 로그인으로 막혀 있고 로그인 후에도 팔로우해야 피드가 보인다",
      repo: "https://github.com/byeonsejun/Junsgram",
    },
  },

  {
    slug: "date",
    name: "Seoul Date",
    tagline:
      '서울 데이트 의사결정을 "날씨 × 위치 × 장소 데이터"로 압축한, 지도 중심 실시간 추천 플랫폼',
    order: 3,
    cover: {
      src: "/projects/date/01-hero.png",
      alt: "메인 진입 화면",
    },
    metrics: [
      {
        label: "API 응답",
        value: "9,935 bytes",
        baseline: "314,546 bytes",
        kind: "measured",
        tone: "positive",
        note: "식당 추천 5건 기준 · base64 내장 방식과의 비교 측정(314,546 대 9,935 bytes)",
      },
      {
        label: "Accessibility",
        value: "96",
        kind: "measured",
        note: "Lighthouse",
      },
      {
        label: "POI",
        value: "2,608건",
        kind: "measured",
        note: "한 · 영 · 일 · 중(간체)",
      },
      {
        label: "플랫폼",
        value: "Web + Native",
        kind: "structural",
        note: "동일 /api 계약 공유",
      },
      { label: "ADR", value: "5건", kind: "measured" },
    ],
    screens: [
      {
        kind: "video",
        src: "/projects/date/02-location-change.mp4",
        caption: "지역 변경 동작",
      },
      {
        kind: "video",
        src: "/projects/date/05-culture-spot-detail.mp4",
        caption: "문화공간 마커 클릭 · 장소 상세 카드",
      },
      {
        kind: "video",
        src: "/projects/date/06-restaurants.mp4",
        caption: "추천 식당 · 맛집 연동",
      },
      {
        kind: "image",
        src: "/projects/date/mobile-iphone12-home.png",
        alt: "iPhone 12 홈 화면 풀페이지 캡처",
        caption: "iPhone 12 (390×844 뷰포트)",
      },
      {
        kind: "image",
        src: "/projects/date/mobile-ipadmini-home.png",
        alt: "iPad mini 홈 화면 풀페이지 캡처",
        caption: "iPad mini (768×1024 뷰포트)",
      },
    ],
    diagrams: [
      {
        title: "서울, 너와 함께 BFF 아키텍처",
        src: "/diagrams/seoul-bff.svg",
      },
    ],
    troubleshooting: {
      title: "응답에 이미지를 담지 않는 설계와 비교 측정",
      situation:
        "식당 추천 API는 장소 사진을 함께 내려줘야 했습니다. 사진을 응답에 직접 담으면 목록 하나 여는 데 얼마가 오가는지 확인할 필요가 있었습니다.",
      cause:
        "사진을 base64로 인코딩해 JSON 안에 넣으면 원본보다 약 33% 커지는 데다, 응답 전체가 하나의 JSON이라 이미지가 다 도착할 때까지 목록을 그릴 수 없습니다.",
      solution:
        "응답에는 이미지 URL만 담고, 실제 이미지는 브라우저가 별도로 받아가게 했습니다. 텍스트 정보가 먼저 도착해 목록이 즉시 그려지고, 이미지는 뒤따라 채워집니다.",
      outcome:
        "base64 내장 방식과의 비교 측정(314,546 대 9,935 bytes)에서 96.84% 작았습니다. 이미지 로딩이 목록 렌더를 막지 않는 구조입니다.",
    },
    techStack: [
      { name: "Next.js 16 (App Router)", category: "framework" },
      { name: "TypeScript (strict)", category: "language" },
      { name: "Zustand", category: "state" },
      { name: "Google Maps API", category: "data" },
      { name: "OpenWeather API", category: "data" },
      { name: "Vercel", category: "infra" },
    ],
    links: {
      demo: "https://date-eight-navy.vercel.app/",
      repo: "https://github.com/byeonsejun/date",
    },
  },

  {
    slug: "netflix",
    name: "SEFLIX",
    tagline:
      'TMDB 데이터를 "탐색 → 미리보기 → 결정"의 흐름으로 압축한, 이미지 중심 영화 탐색 SPA',
    order: 4,
    cover: {
      src: "/projects/netflix/01-home.png",
      alt: "SEFLIX 홈 화면",
      caption: "홈 배너 + 카테고리 슬라이더",
    },
    metrics: [
      {
        label: "Performance",
        value: "93",
        kind: "measured",
        note: "Lighthouse 13.2.0 · Emulated Desktop · 2026.06.17",
      },
      { label: "Accessibility", value: "98", kind: "measured" },
      { label: "Best Practices", value: "100", kind: "measured" },
      { label: "SEO", value: "100", kind: "measured" },
      { label: "LCP", value: "1.6s", kind: "measured", note: "Good 구간" },
      { label: "CLS", value: "0", kind: "measured", note: "Good 구간" },
      { label: "TBT", value: "0ms", kind: "measured", note: "Good 구간" },
    ],
    screens: [
      // 원본 GIF 는 mp4 로 대체됐다(3.3MB → 443KB). 원본은 media-src/ 에 있고
      // 배포되지 않는다. 800x388 이라 확대해도 얻을 게 없어 라이트박스는 막는다.
      {
        kind: "video",
        src: "/derived/netflix/02-hover-preview.mp4",
        caption: "카드 호버 → 3초 뒤 트레일러 자동재생 (핵심 UX)",
      },
      {
        kind: "video",
        src: "/derived/netflix/03-movies-filter.mp4",
        caption: "정렬 / 장르 / 개봉연도 필터 동작",
      },
      {
        kind: "image",
        src: "/projects/netflix/04-detail.png",
        alt: "상세 페이지",
        caption: "상세 — 예고편 버튼 · 리뷰(2)/추천(20) 탭",
      },
    ],
    diagrams: [
      {
        title: "SEFLIX Redux 단방향 데이터 흐름",
        src: "/diagrams/seflix-flow.svg",
      },
    ],
    troubleshooting: {
      title: "예고편 모달이 중복으로 열리는 문제",
      situation:
        "카드 사이로 마우스를 빠르게 옮기면 예고편 모달이 여러 개 겹쳐 열렸습니다.",
      cause:
        "호버할 때마다 영상 정보를 비동기로 요청하는데, 응답 도착 순서가 요청 순서와 다를 수 있습니다. 먼저 벗어난 카드의 응답이 나중에 도착하면, 이미 떠나온 카드의 모달이 뒤늦게 열립니다.",
      solution:
        "카드마다 UUID를 부여하고 전역 modalId와 일치할 때만 모달을 열도록 했습니다. 응답이 도착해도 자기 차례가 아니면 무시됩니다. 호버 3초 후에 요청하고 벗어나면 취소해, 스쳐 지나가는 호버는 애초에 요청하지 않습니다.",
      outcome: "모달 중복이 사라졌고, 불필요한 API 호출도 함께 줄었습니다.",
    },
    techStack: [
      { name: "React 18", category: "framework" },
      { name: "Redux Toolkit", category: "state" },
      { name: "React Router 6", category: "framework" },
      { name: "TMDB REST API", category: "data" },
      { name: "Vercel", category: "infra" },
    ],
    links: {
      demo: "https://seflix.vercel.app",
      repo: "https://github.com/byeonsejun/netflix",
    },
  },

  {
    slug: "shoppy",
    name: "SHOPPY",
    tagline: "React 기반 패션 커머스 웹 애플리케이션",
    order: 5,
    cover: {
      src: "/projects/shoppy/preview-home.png",
      alt: "SHOPPY 홈 화면 미리보기",
    },
    // 의도적으로 비움 — 5순위 프로젝트라 배지 없이 간결하게 간다.
    metrics: [],
    screens: [
      {
        kind: "image",
        src: "/projects/shoppy/preview-shop.png",
        alt: "상품 목록 화면",
        caption: "상품 목록 — 정렬 · BEST/HOT/NEW 배지",
      },
    ],
    diagrams: [
      {
        title: "SHOPPY 서버 상태 캡슐화 구조",
        src: "/diagrams/shoppy-state.svg",
      },
    ],
    troubleshooting: {
      title: "비로그인 상태에서 발생하던 불필요한 요청",
      situation:
        "로그인하지 않은 사용자가 페이지에 들어와도 장바구니 조회 요청이 나갔습니다.",
      cause:
        "useCart 훅이 컴포넌트 마운트 시점에 무조건 실행됐습니다. uid가 없으면 조회할 대상 자체가 없는데도 요청은 그대로 나갔습니다.",
      solution:
        "React Query의 enabled: !!uid 가드를 걸어 uid가 확정된 뒤에만 쿼리가 실행되게 했습니다.",
      outcome:
        "비로그인 사용자의 불필요한 요청이 사라졌습니다. Firebase REST 호출을 fetch 얇은 래퍼로 직접 제어하고 모든 읽기에 빈 값 폴백을 두어, 네트워크 실패가 화면 전체를 깨뜨리지 않도록 했습니다.",
    },
    techStack: [
      { name: "React 18", category: "framework" },
      { name: "React Router 6", category: "framework" },
      { name: "TanStack Query 4", category: "state" },
      { name: "Firebase (Auth + RTDB)", category: "data" },
      { name: "Cloudinary", category: "infra" },
      { name: "Tailwind CSS 3", category: "styling" },
    ],
    links: {
      demo: "https://sejun-shop.netlify.app",
      repo: "https://github.com/byeonsejun/shoppy",
    },
  },
];
