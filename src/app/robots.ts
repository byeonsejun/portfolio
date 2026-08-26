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
 * sitemap 은 선언하지 않는다 — 단일 페이지라 만들지 않았고, 없는 파일을
 * 가리키면 크롤러가 404 를 받는다.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/*.txt$",
    },
    host: SITE_URL,
  };
}
