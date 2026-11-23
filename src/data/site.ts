/** 사이트 전역 상수. 프로젝트 데이터가 아닌 것들. */

export const GITHUB_HREF = "https://github.com/byeonsejun";

/**
 * 배포 원본. OG·트위터 카드가 절대 URL 을 요구해서 필요하다.
 *
 * 커스텀 도메인 기준이다. pages.dev 주소도 여전히 살아 있지만, 공유된 링크의
 * 미리보기가 두 도메인으로 갈리지 않도록 정본 하나만 가리킨다.
 */
export const SITE_URL = "https://sejunb.com";

/**
 * 구조화 데이터 Person.knowsAbout 에 싣는 기술. 본인이 직접 정한 목록이다.
 *
 * 화면에 글자로 보이는 기술만 싣는다. 구조화 데이터에만 있고 화면에는 없는
 * 정보는 검색엔진이 불일치로 본다. scripts/verify-seo.mjs 가 이 목록의 항목이
 * 빌드된 홈의 본문 텍스트에 모두 나오는지 확인한다.
 *
 * 카드의 techStack 에서 뽑지 않고 고정한다. 카드 techStack 은 프로젝트마다 순서가
 * 달라서, 앞에서부터 자르면 백엔드 항목(Prisma · pgvector 등)이 먼저 차지해
 * 프론트엔드 개발자의 핵심 기술(React · Tailwind CSS …)이 밀려난다.
 * verify-seo 가 이 파일을 직접 import 하므로 값을 고치면 검사도 같이 따라온다.
 */
export const KNOWS_ABOUT = [
  "React",
  "TypeScript",
  "Next.js",
  "Zustand",
  "Tailwind CSS",
  "three.js",
  "Vitest",
  "Playwright",
] as const;
