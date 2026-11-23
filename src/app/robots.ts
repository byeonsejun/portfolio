import type { MetadataRoute } from "next";
import { SITE_URL } from "@/data/site";

/*
 * output: "export" 에서는 라우트 핸들러가 빌드 타임에 한 번만 실행된다는 걸
 * 명시해야 한다. 없으면 "force-static 이 설정되지 않았다" 며 빌드가 멈춘다.
 */
export const dynamic = "force-static";

/**
 * robots.txt.
 *
 * 전체 허용이 기본이지만 .txt 는 막는다. 정적 export 는 클라이언트 라우팅용으로
 * RSC 페이로드를 index.txt · __next._full.txt 등으로 함께 내보내는데, 그 안에
 * 페이지 본문이 통째로 들어 있다. 색인되면 같은 내용이 두 URL 로 잡혀
 * 중복 콘텐츠가 된다. 사람이 볼 파일도 아니다.
 *
 * 다만 /llms.txt 하나는 예외로 연다. 사람이 아니라 AI 크롤러가 읽으라고
 * 만든 요약 파일이라 막으면 존재 의미가 없다. 구글·빙은 더 길고 구체적인
 * 규칙을 먼저 적용하므로 "Allow: /llms.txt" 가 "Disallow: /*.txt$" 보다
 * 우선한다.
 * 대신 Allow 를 "/*.txt" 처럼 넓게 쓰면 index.txt 까지 같이 열리니 금물이다.
 *
 * sitemap 은 이제 선언한다. 예전엔 단일 페이지라 만들지 않았고 없는 파일을
 * 가리키면 크롤러가 404 를 받으니 비웠지만, 지금은 sitemap.ts 가 실제 파일을
 * 내보낸다. 검색 노출을 성과로 근거 있게 남기기로 했으니, 정본 URL 을 크롤러에
 * 직접 알려 주는 쪽이 낫다. (verify-seo 가 선언과 파일 존재를 함께 검사한다.)
 *
 * host 도 선언하지 않는다. 표준 밖의 지시어라 구글·빙은 아예 읽지 않고,
 * 유일하게 쓰던 얀덱스도 2018 년에 폐기하고 rel=canonical 로 옮겼다. 즉
 * 정본 도메인을 정하는 힘이 없다. 그런데 파일에 남아 있으면 "정본 선언이
 * 되어 있다" 는 착각을 부른다 — 실제로 그 착각 때문에 pages.dev 중복 색인을
 * 한동안 못 봤다. 정본은 <link rel="canonical"> 로만 말한다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/llms.txt"],
      disallow: "/*.txt$",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
