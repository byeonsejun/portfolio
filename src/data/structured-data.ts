import type { ResolvedProject } from "@/types/project";

import { GITHUB_HREF, SITE_URL } from "./site";

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

/** knowsAbout 에 싣는 기술 개수 상한. 너무 길면 신호가 아니라 잡음이 된다. */
const KNOWS_ABOUT_LIMIT = 10;

/**
 * 카드가 가리키는 대표 주소. 라이브 데모가 있으면 그것, 없으면 저장소.
 * 둘 다 없으면 undefined — 호출하는 쪽이 url 키를 아예 빼야 한다
 * (빈 문자열 url 은 구조화 데이터 검사에서 오류로 잡힌다).
 */
export function projectUrl(p: ResolvedProject): string | undefined {
  return p.links.demo ?? p.links.repo ?? undefined;
}

/** 카드들의 techStack 이름을 처음 나온 순서대로, 정확히 같은 이름만 걸러 모은다. */
function collectTechNames(projects: readonly ResolvedProject[]): string[] {
  const names = new Set<string>();
  for (const p of projects) {
    for (const tech of p.techStack) names.add(tech.name);
  }
  return [...names].slice(0, KNOWS_ABOUT_LIMIT);
}

function buildProjectItem(p: ResolvedProject, position: number) {
  const url = projectUrl(p);
  const repo = p.links.repo;

  return {
    "@type": "ListItem",
    position,
    item: {
      "@type": "CreativeWork",
      name: p.name,
      description: p.tagline,
      ...(url ? { url } : {}),
      /* 데모가 url 로 나갔을 때만 저장소를 sameAs 로 덧붙인다. 같은 주소를 두 번 쓰지 않는다. */
      ...(repo && repo !== url ? { sameAs: repo } : {}),
    },
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
      knowsAbout: collectTechNames(projects),
    },
    hasPart: {
      "@type": "ItemList",
      itemListElement: projects.map((p, i) => buildProjectItem(p, i + 1)),
    },
  };
}

/**
 * <script> 안에 그대로 넣을 문자열.
 * 카드 문구에 "</script>" 가 섞이면 태그가 거기서 닫혀 버리니 `<` 를 유니코드로
 * 바꾼다. JSON 파서는 < 를 원래 문자로 읽으므로 의미는 그대로다.
 */
export function toJsonLdScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
