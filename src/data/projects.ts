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
    // 저장소 README 의 "코드는 AI가, 판단은 내가" 와 같은 입장. 결정 회고는 links.writeup.
    role: "판단 · 의사결정은 직접, 구현의 상당 부분은 Claude Code",
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
      title: "AI가 찾은 1등 가중치를 운영에 넣지 않은 이유",
      situation:
        "검색 점수는 벡터 0.5 · 키워드 0.2 · 지역 0.2 · 테마 0.1의 가중합입니다. AI로 가중치 조합 286개를 전부 평가하는 nDCG 측정 도구를 만들었고, 1등 설정으로 바꾸는 건 상수 한 줄이었습니다.",
      cause:
        "1등을 믿을 근거가 빈약했습니다. 평가 쿼리 10개는 대부분 nDCG 1.000으로 포화돼 우열을 가리지 못했고, 1등의 이득은 +0.0099(상대 1.1%)로 측정 노이즈 수준이었습니다. 게다가 공동 1등 4개가 모두 벡터 가중치를 0.1 이하로 굶긴 설정이었습니다. 작은 평가셋에 과적합된 신호로 판단했습니다.",
      solution:
        "가중치는 바꾸지 않고 측정 도구를 넓히기로 결정했습니다. 상품 20건이 실제로 지원하는 차원만 자극하는 쿼리 45개를 다섯 유형(의미 · 지역 · 테마 · 조건 · 적대적)으로 나눠 다시 쟀습니다.",
      outcome:
        "벡터를 굶긴 공동 1등은 4건에서 0건으로 사라졌습니다. \"1등\"은 작은 셋에 과적합된 신호였습니다. 대신 의미 검색 유형에서 0.61이라는 약점이 드러났는데, 교정은 실제 트래픽이 생긴 뒤 온라인 지표로 하기로 하고 ADR에 남겼습니다. 운영 코드는 한 줄도 바뀌지 않았습니다.",
      references: [
        {
          label: "ADR-0054",
          href: "https://github.com/byeonsejun/travel_agency/blob/main/docs/superpowers/adr/0054-search-weight-tuning-deferred.md",
        },
      ],
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
      writeup:
        "https://github.com/byeonsejun/travel_agency/blob/main/docs/engineering-judgment.md",
    },
  },

  {
    slug: "meisho-japan",
    name: "명당재팬",
    tagline:
      "일본 복권 1등 판매점(명당) 157곳을 지도에 모은, 한국인 여행자용 정적 사이트",
    role: "제품 정의 · 의사결정 · 검수는 직접, 구현은 Claude Code",
    order: 2,
    cover: {
      src: "/projects/meisho/home.png",
      alt: "명당재팬 홈 — 도쿄 지도와 내 주변 명당 목록",
    },
    metrics: [
      {
        label: "판매점",
        value: "157곳",
        kind: "measured",
        note: "지도 핀 100% · 자동 73 · 수동 확인 84",
      },
      {
        label: "하드코딩 색",
        value: "0곳",
        baseline: "80곳",
        kind: "measured",
        tone: "positive",
        note: "리디자인 PR #2 · 토큰 정의 파일 밖 기준",
      },
      {
        label: "단위 테스트",
        value: "585건",
        kind: "measured",
        note: "Vitest · 파서는 실제 기사 HTML fixture",
      },
      {
        label: "E2E",
        value: "60건",
        kind: "measured",
        note: "Playwright · CLS · 출처 정적 렌더 · 글꼴 로딩 순서 회귀 테스트 포함 · 3건은 조건부 skip",
      },
      {
        label: "CLS (데스크톱)",
        value: "0.0001",
        baseline: "0.19",
        kind: "measured",
        tone: "positive",
        note: "모바일 0.106 → 0.0006 · 데스크톱 Performance 88–90 → 97–99 · PR #4–#7",
      },
      {
        label: "지도 첫 화면 데이터",
        value: "503KB",
        baseline: "751KB",
        kind: "measured",
        tone: "positive",
        note: "시작 줌 11 → 10 · 타일 6장 → 2장 · 느린 모바일에서 지도 완성 1.5초 단축 · PR #7",
      },
      {
        label: "Lighthouse",
        value: "100 · 100 · 100",
        kind: "measured",
        note: "접근성 · 권장사항 · SEO · 모바일/데스크톱 11회 모두 · 13.4.1 · 2026.11.02",
      },
      {
        label: "운영 비용",
        value: "0원",
        kind: "measured",
        note: "유료 API · API 키 없음",
      },
      {
        label: "핀 규칙",
        value: "fail-closed",
        kind: "structural",
        note: "번지 수준 일치만 자동 · 나머지는 확인 대기",
      },
      {
        label: "수집",
        value: "GitHub Actions cron",
        kind: "structural",
        note: "번호는 추첨 뒤 자동 커밋 · 판매점은 데이터 PR",
      },
    ],
    screens: [
      {
        kind: "image",
        src: "/projects/meisho/region.png",
        alt: "도쿄도 지역 페이지",
        caption: "지역 페이지 — 도쿄도 명당 순위 · 1등 횟수만큼 커지는 소인 핀",
      },
      {
        kind: "image",
        src: "/projects/meisho/store.png",
        alt: "판매점 상세 화면",
        caption: "판매점 상세 — 당첨 이력 · 길찾기/공유/저장 · 긴자 일대 핀",
      },
      {
        kind: "image",
        src: "/projects/meisho/numbers.png",
        alt: "로또6 당첨번호 화면",
        caption: "당첨번호 — 회차 선택 · 등수별 당첨금 · 이 회차 1등 판매점",
      },
      {
        kind: "image",
        src: "/projects/meisho/guide.png",
        alt: "당첨금 받는 법 가이드",
        caption: "여행자 가이드 — 당첨금 받는 법",
      },
      {
        kind: "image",
        src: "/projects/meisho/mobile-home.png",
        alt: "iPhone 홈 화면 캡처",
        caption: "iPhone (390×844 뷰포트) — 지도 + 바텀시트",
      },
    ],
    diagrams: [
      {
        title: "명당재팬 데이터 파이프라인",
        src: "/diagrams/meisho-pipeline.svg",
        description:
          "GitHub Actions 가 추첨 일정에 맞춰 신문 기사와 공식 사이트를 수집한다. 확실한 좌표만 자동으로 핀을 찍고, 나머지는 확인 대기 큐로 보내 사람이 data/manual 에 보정한다. 사이트는 zod 로 검증한 data/curated 만 읽어 정적 HTML 로 빌드된다.",
      },
    ],
    troubleshooting: {
      title: "자동으로 찍을 수 있어도, 확실하지 않으면 찍지 않는다",
      situation:
        "판매점 주소를 국토지리원 주소 검색 API로 좌표로 바꿔 지도에 핀을 찍습니다. 핀이 틀리면 여행자가 엉뚱한 곳으로 길을 찾아가니, 이 서비스에서 가장 비싼 오류입니다.",
      cause:
        "지오코더는 주소를 끝까지 찾지 못해도 더 짧은 주소로 물러나 그럴듯한 좌표를 돌려줍니다. 응답만 봐서는 성공과 실패를 구분할 수 없습니다.",
      solution:
        "설계 단계에서 주소가 번지 수준까지 정확히 일치할 때만 자동으로 핀을 찍고, 나머지는 지도에 \"위치 확인 중\"으로 두기로 결정했습니다. 구현은 Claude Code가 했습니다. 출시 전 최종 코드 리뷰(별도 Claude 리뷰어)에서 이 규칙을 빠져나가는 구멍 두 개가 나왔습니다. 잘린 주소가 \"일치\"로 판정되는 경우와, 단위가 다른 번지(‘1초메 10’과 ‘1반 10고’)가 같은 문자열로 접히는 경우입니다. 둘 다 회귀 테스트로 막았습니다. 실제 데이터에서 틀린 핀이 나간 사고는 아니었습니다.",
      outcome:
        "대가는 핀 수였습니다. 첫 수집 때는 148곳 중 80곳에만 핀이 찍혔습니다. 일부는 제가 구글맵으로 직접 확인해 채웠고, 공식 좌표와 국토지리원 좌표가 150m 안에서 일치하면 자동으로 찍는 조건을 더했습니다. 지금은 157곳 모두 핀이 있고 확인 대기는 0건입니다.",
    },
    techStack: [
      { name: "Next.js 16 (App Router · static export)", category: "framework" },
      { name: "TypeScript (strict)", category: "language" },
      { name: "maplibre-gl", category: "data" },
      { name: "zod 4", category: "data" },
      { name: "Tailwind CSS v4", category: "styling" },
      { name: "cheerio", category: "tooling" },
      { name: "Vitest + Playwright", category: "testing" },
      { name: "GitHub Actions", category: "infra" },
      { name: "Cloudflare Pages", category: "infra" },
      { name: "Claude Code", category: "tooling" },
    ],
    links: {
      demo: "https://meisho-japan.pages.dev",
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
    slug: "lumen",
    name: "LUMEN",
    tagline:
      "어두운 쇼룸에서 3D로 가구를 둘러보고, 천 색을 바꿔 보고, 내 방 크기에 직접 놓아 본 뒤 결제하면 그 위로 불이 켜지는 가구 쇼핑몰. 기기 성능에 맞춰 스스로 품질을 낮추고 올린다",
    role: "방향 · 기술 선택 · 실기기 검수는 직접, 설계 세부와 구현은 Claude Code",
    order: 5,
    cover: {
      src: "/projects/lumen/spotlight.png",
      alt: "LUMEN 쇼룸 — 스포트라이트 아래의 3인 소파",
    },
    metrics: [
      {
        label: "모바일 LCP (홈)",
        value: "5.8s",
        baseline: "16.2s",
        kind: "measured",
        tone: "positive",
        note: "3D 초기화를 load 뒤 유휴 시간으로 · TBT 9,750ms → 910ms · Lighthouse 12 모바일 · 2026.11.02",
      },
      {
        label: "CLS (상품 상세)",
        value: "0.003",
        baseline: "0.373",
        kind: "measured",
        tone: "positive",
        note: "3D 영역 로딩 중 같은 크기 자리 확보 · Lighthouse 12 모바일",
      },
      {
        label: "쇼룸 fps",
        value: "59.6",
        kind: "measured",
        note: "M1 · 최고 품질 고정 · 쇼룸 끝까지 스크롤 평균 · 하위 10% 59",
      },
      {
        label: "3D 모델",
        value: "20개 · 33MB",
        kind: "measured",
        note: "Poly Haven 원본을 빌드 전에 압축 · 저화질본은 전부 2MB 이하",
      },
      {
        label: "테스트",
        value: "212건",
        kind: "measured",
        note: "단위 109 · DB 통합 28 · Playwright 75 · 금액 위조 · 새로고침 재승인 · 끊긴 요청 재현 · 색별 장바구니 · 방 배치 포함",
      },
      {
        label: "색 바꾸기",
        value: "텍스처 한 장에서 천만",
        kind: "structural",
        note: "대표색과의 거리로 가림막 → 밝기 비율 유지 재채색 셰이더 · 7개 가구 · 고른 색이 주문까지",
      },
      {
        label: "결제",
        value: "서버 재계산 · 승인 1회",
        kind: "structural",
        note: "토스페이먼츠 테스트 결제 · 금액이 다르면 승인 거부 · 주문 번호를 멱등 키로",
      },
      {
        label: "렌더러",
        value: "WebGPU → WebGL2 → 이미지",
        kind: "structural",
        note: "WebGPURenderer 하나 · 노드 머티리얼과 TSL만 사용",
      },
      {
        label: "품질 조절",
        value: "3단계 · 1초마다",
        kind: "structural",
        note: "DPR · 그림자 · bloom · AO · 텍스처 1k/2k",
      },
    ],
    screens: [
      {
        kind: "image",
        src: "/projects/lumen/colors.png",
        alt: "Velvet 2인 소파 네 가지 색 — 조각 원목 프레임은 그대로",
        caption: "색 바꾸기 — 천과 나무가 한 장에 그려진 텍스처에서 천만 다시 칠한다",
      },
      {
        kind: "image",
        src: "/projects/lumen/room-planner.png",
        alt: "내 방에 놓아 보기 — 방 크기 입력과 가구 배치",
        caption: "내 방에 놓아 보기 — 방 크기를 넣고 담은 가구를 끌어 옮기고 돌린다",
      },
      {
        kind: "image",
        src: "/projects/lumen/cart.png",
        alt: "담은 가구가 자동으로 놓인 장바구니 방과 목록",
        caption: "장바구니 — 담은 가구가 방에 놓인다. 목록에 마우스를 올리면 그 가구에 조명이",
      },
      {
        kind: "image",
        src: "/projects/lumen/complete.png",
        alt: "결제 완료 후 불이 켜진 방",
        caption: "결제 완료 — 어두운 방에서 산 가구 위로 불이 하나씩 켜진다",
      },
      {
        kind: "image",
        src: "/projects/lumen/room.png",
        alt: "가구들이 놓인 방 전체",
        caption: "마지막 장면 — 조명이 켜지며 방이 드러나고, 가구를 누르면 상세로",
      },
      {
        kind: "image",
        src: "/projects/lumen/detail.png",
        alt: "상품 상세 3D 뷰어와 치수",
        caption: "상품 상세 — 돌려 보기 · 확대 · 실제 치수(mm) 표시",
      },
      {
        kind: "image",
        src: "/projects/lumen/spotlight-table.png",
        alt: "스포트라이트 아래의 커피 테이블",
        caption: "쇼룸 — 스크롤하면 다음 가구가 조명 아래로 들어온다",
      },
      {
        kind: "image",
        src: "/projects/lumen/shop.png",
        alt: "상품 목록",
        caption: "상품 목록 — 카테고리 탭 · 3D는 목록에서 쓰지 않는다",
      },
      {
        kind: "image",
        src: "/projects/lumen/mobile-spotlight.png",
        alt: "모바일 쇼룸 화면",
        caption: "모바일 (390×844 뷰포트) — 같은 스크롤 연출, 품질은 mid에서 시작",
      },
    ],
    diagrams: [
      {
        title: "LUMEN 렌더러 폴백과 품질 자동 조절",
        src: "/diagrams/lumen-quality.svg",
        description:
          "무엇으로 그릴지는 접속할 때 한 번 정한다. WebGPU 어댑터를 못 얻으면 같은 렌더러를 WebGL2 백엔드로 돌리고, 그것도 안 되면 3D 대신 이미지를 둔다. 얼마나 그릴지는 1초마다 다시 정한다. 시작값은 GPU 등급으로 잡고, 실제 프레임을 보면서 한 단계씩 내리고 올린다.",
      },
    ],
    troubleshooting: {
      title: "품질 조절이 좋은 기기에서도 최저 품질로 시작했다",
      situation:
        "1초마다 평균 fps를 재서 30 아래면 품질을 한 단계 내리는 규칙을 붙였습니다. 그런데 M1 맥북에서 쇼룸을 열자 첫 화면부터 그림자도 bloom도 없는 최저 단계로 떨어져 있었습니다.",
      cause:
        "화면 구석에 fps를 띄워 보니 첫 1초가 4fps였습니다. 셰이더 컴파일과 3D 모델 디코딩이 처음 몇 프레임을 잡아먹는 구간이라, 기기가 느린 게 아니라 준비 중이었던 겁니다. 같은 이유로 탭을 숨겼다 돌아오는 순간도 위험했습니다. 그동안 프레임이 멈췄으니 숫자만 보면 저사양으로 보입니다.",
      solution:
        "판단에 쓰는 측정을 걸렀습니다. 시작 직후 두 구간은 화면에만 보여 주고 판단에서는 빼고, 1.5초보다 길게 늘어진 구간도 버립니다. 단계를 바꾼 뒤에는 이전 측정을 지워 새 상태로만 다시 판단합니다. GPU 등급이 최저로 나와도 한 단계는 올라갈 여지를 남겨, 첫 판정이 틀렸을 때 실제 프레임으로 회복할 수 있게 했습니다. 이 규칙은 순수 함수로 떼어 단위 테스트로 묶었습니다.",
      outcome:
        "M1에서는 쇼룸 끝까지 최고 단계를 유지했습니다(평균 59.9fps). 모바일 에뮬레이션에서는 중간 단계로 시작해 실제 프레임을 보고 최고 단계로 올라갔습니다. 반대로 GPU 없는 테스트 브라우저에서는 11fps가 나오자 최저 단계까지 내려가, 내려야 할 때는 제대로 내려간다는 것도 확인했습니다.",
    },
    techStack: [
      { name: "Next.js 16 (App Router · Cache Components)", category: "framework" },
      { name: "TypeScript (strict)", category: "language" },
      { name: "three.js (WebGPURenderer · TSL)", category: "framework" },
      { name: "React Three Fiber · drei", category: "framework" },
      { name: "zustand", category: "state" },
      { name: "Tailwind CSS v4", category: "styling" },
      { name: "Auth.js v5 (카카오 · 구글 · 데모 계정)", category: "auth" },
      { name: "Prisma · Neon Postgres", category: "data" },
      { name: "토스페이먼츠 (테스트 결제)", category: "infra" },
      { name: "glTF-Transform · meshoptimizer", category: "tooling" },
      { name: "Vitest + Playwright", category: "testing" },
      { name: "Vercel", category: "infra" },
      { name: "Claude Code", category: "tooling" },
    ],
    links: {
      demo: "https://lumen-showroom.vercel.app",
      repo: "https://github.com/byeonsejun/lumen",
    },
  },
];
