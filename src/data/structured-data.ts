import type { ResolvedProject } from "@/types/project";

import { GITHUB_HREF, KNOWS_ABOUT, SITE_URL } from "./site";

/**
 * 검색엔진·AI 에게 "이 페이지는 누구의 포트폴리오이고 무슨 작업이 있는지"를
 * 기계가 읽는 형태로 알려 주는 JSON-LD.
 *
 * 값을 이 파일에 따로 적지 않고 카드 데이터에서 만든다. 카드 이름·한 줄 소개·
 * 링크가 바뀌면 구조화 데이터도 같이 바뀌어야 하는데, 손으로 두 벌을 적으면
 * 어느 쪽이 먼저 낡는지 알 수 없다.
 *
 * 이메일은 일부러 넣지 않는다. 사이트가 ObfuscatedEmail 로 가려 둔 값이라
 * 여기 평문으로 적으면 스팸 수집기가 가장 먼저 가져간다.
 */

/**
 * 카드가 가리키는 대표 주소. 라이브 데모가 있으면 그것, 없으면 저장소.
 * 둘 다 없으면 undefined — 호출하는 쪽이 url 키를 아예 빼야 한다
 * (빈 문자열 url 은 구조화 데이터 검사에서 오류로 잡힌다).
 */
export function projectUrl(p: ResolvedProject): string | undefined {
  return p.links.demo ?? p.links.repo ?? undefined;
}

/**
 * 프로젝트 하나를 CreativeWork 로. Person.workExample 의 원소다.
 *
 * 처음엔 ProfilePage.hasPart 아래 ItemList 로 감쌌는데 schema.org validator 가
 * 거부했다 — hasPart 는 CreativeWork 나 Role 만 받는다(INVALID_OBJECT).
 * "이 사람이 만든 작업물" 이라는 뜻에도 Person.workExample 이 더 맞아서,
 * 순서 정보(ListItem.position)는 버리고 배열 순서(카드 순서)로 갈음한다.
 */
function buildWorkExample(p: ResolvedProject) {
  const url = projectUrl(p);
  const repo = p.links.repo;

  return {
    "@type": "CreativeWork",
    name: p.name,
    description: p.tagline,
    ...(url ? { url } : {}),
    /* 데모가 url 로 나갔을 때만 저장소를 sameAs 로 덧붙인다. 같은 주소를 두 번 쓰지 않는다. */
    ...(repo && repo !== url ? { sameAs: repo } : {}),
  };
}

export function buildProfileJsonLd(
  projects: readonly ResolvedProject[],
): Record<string, unknown> {
  const homeUrl = `${SITE_URL}/`;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: homeUrl,
    name: "변세준 — 프론트엔드 개발자 포트폴리오",
    mainEntity: {
      "@type": "Person",
      name: "변세준",
      alternateName: "BYUN SEJUN",
      jobTitle: "프론트엔드 개발자",
      url: homeUrl,
      sameAs: [GITHUB_HREF],
      knowsAbout: [...KNOWS_ABOUT],
      workExample: projects.map(buildWorkExample),
    },
  };
}

/**
 * <script> 안에 그대로 넣을 문자열.
 * 카드 문구에 "</script>" 가 섞이면 태그가 거기서 닫혀 버리니 `<` 를 유니코드로
 * 바꾼다. JSON 파서는 \u003c 를 원래 문자로 읽으므로 의미는 그대로다.
 */
export function toJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
